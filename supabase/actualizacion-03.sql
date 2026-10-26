-- =====================================================================
-- Despensa Mi-Ma · Actualización 03
-- Mercado Pago (cobro con QR y cobros recibidos) + datos del cliente
-- en cualquier venta (nombre, apellido, apodo, DNI).
--
-- Antes tiene que estar corrida la actualización 02.
-- Supabase > SQL Editor > New query > pegar todo > Run
-- =====================================================================

-- ---------- CLIENTES: más datos ----------
alter table clientes add column if not exists apellido text;
alter table clientes add column if not exists apodo    text;
alter table clientes add column if not exists dni      text;

-- la vista se rehace para que incluya las columnas nuevas
drop view if exists clientes_saldo;
create view clientes_saldo with (security_invoker = true) as
select c.*,
       coalesce(sum(case when m.tipo = 'compra' then m.monto else -m.monto end), 0)::numeric(12,2) as saldo,
       max(m.fecha) as ultimo_movimiento
  from clientes c
  left join fiado_movimientos m on m.cliente_id = c.id
 group by c.id;

-- ---------- VENTAS: método QR de Mercado Pago ----------
alter table ventas drop constraint if exists ventas_metodo_pago_check;
alter table ventas add constraint ventas_metodo_pago_check
  check (metodo_pago in ('efectivo','transferencia','debito','fiado','mercadopago'));

alter table ventas add column if not exists mp_ref text;   -- referencia del QR que se cobró
create unique index if not exists idx_ventas_mp_ref on ventas(mp_ref) where mp_ref is not null;

-- ---------- COBROS QUE ENTRARON A MERCADO PAGO ----------
create table if not exists cobros_mp (
  id              text primary key,          -- id del pago en Mercado Pago
  fecha           timestamptz not null,
  monto           numeric(12,2) not null,
  neto            numeric(12,2),             -- lo que queda después de la comisión
  tipo            text,                      -- account_money, bank_transfer, credit_card, debit_card...
  metodo          text,
  operacion       text,                      -- regular_payment, money_transfer, account_fund...
  estado          text,
  referencia      text,                      -- external_reference (si vino de nuestro QR)
  pagador_nombre  text,
  pagador_email   text,
  pagador_doc     text,
  descripcion     text,
  venta_id        bigint references ventas(id) on delete set null,
  sincronizado_en timestamptz not null default now()
);
create index if not exists idx_cobros_mp_fecha on cobros_mp(fecha);

alter table cobros_mp enable row level security;
drop policy if exists "solo_logueados" on cobros_mp;
create policy "solo_logueados" on cobros_mp for all to authenticated using (true) with check (true);

-- Une los cobros que vinieron de un QR de la caja con su venta
create or replace function vincular_cobros_qr()
returns integer
language plpgsql
security invoker
as $$
declare v_cant integer;
begin
  update cobros_mp c
     set venta_id = v.id
    from ventas v
   where c.venta_id is null
     and c.referencia is not null
     and v.mp_ref = c.referencia;
  get diagnostics v_cant = row_count;
  return v_cant;
end $$;

-- ---------- REGISTRAR VENTA (versión 3) ----------
-- Ahora acepta cliente con cualquier forma de pago (en fiado es obligatorio)
-- y la referencia del QR de Mercado Pago.
drop function if exists registrar_venta(text, jsonb);
drop function if exists registrar_venta(text, jsonb, bigint);

create or replace function registrar_venta(
  p_metodo     text,
  p_items      jsonb,
  p_cliente_id bigint default null,
  p_mp_ref     text default null
)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_venta_id bigint;
  v_total    numeric(12,2) := 0;
  v_item     record;
  v_prod     productos%rowtype;
  v_nombre   text;
  v_precio   numeric(12,2);
  v_costo    numeric(12,2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_metodo = 'fiado' and p_cliente_id is null then
    raise exception 'Para anotar en el fiado hay que elegir un cliente';
  end if;
  -- si ya se registró la venta de este QR (por ejemplo, un doble toque), devuelve la misma
  if p_mp_ref is not null then
    select id into v_venta_id from ventas where mp_ref = p_mp_ref;
    if found then return v_venta_id; end if;
  end if;

  insert into ventas (total, metodo_pago, cliente_id, mp_ref)
  values (0, p_metodo, p_cliente_id, p_mp_ref)
  returning id into v_venta_id;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(producto_id bigint, cantidad int, nombre text, precio numeric)
  loop
    if v_item.cantidad is null or v_item.cantidad <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    if v_item.producto_id is not null then
      select * into v_prod from productos where id = v_item.producto_id for update;
      if not found then
        raise exception 'Producto % no existe', v_item.producto_id;
      end if;
      v_nombre := v_prod.nombre;
      v_precio := v_prod.precio_venta;
      v_costo  := v_prod.precio_costo;

      update productos set stock = stock - v_item.cantidad where id = v_prod.id;
      insert into movimientos_stock (producto_id, tipo, cantidad, nota)
      values (v_prod.id, 'venta', -v_item.cantidad, 'Venta #' || v_venta_id);
    else
      v_nombre := coalesce(nullif(trim(v_item.nombre), ''), 'Varios');
      v_precio := coalesce(v_item.precio, 0);
      v_costo  := 0;
      if v_precio <= 0 then
        raise exception 'El precio de "%" tiene que ser mayor a 0', v_nombre;
      end if;
    end if;

    insert into venta_items (venta_id, producto_id, nombre, cantidad, precio_unitario, precio_costo, subtotal)
    values (v_venta_id, v_item.producto_id, v_nombre, v_item.cantidad, v_precio, v_costo, v_precio * v_item.cantidad);

    v_total := v_total + v_precio * v_item.cantidad;
  end loop;

  update ventas set total = v_total where id = v_venta_id;

  if p_metodo = 'fiado' then
    insert into fiado_movimientos (cliente_id, tipo, monto, venta_id, nota)
    values (p_cliente_id, 'compra', v_total, v_venta_id, 'Venta #' || v_venta_id);
  end if;

  if p_mp_ref is not null then
    perform vincular_cobros_qr();
  end if;

  return v_venta_id;
end $$;
