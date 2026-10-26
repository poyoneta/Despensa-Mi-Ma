-- =====================================================================
-- Despensa Mi-Ma · Actualización 02
-- Usuarios (Mateo y Mika), anular ventas, cierre de caja, fiado,
-- accesos rápidos, precio libre y ganancia en reportes.
--
-- Se corre UNA vez sobre la base que ya tenés (no borra nada):
-- Supabase > SQL Editor > New query > pegar todo > Run
-- Si lo corrés dos veces no pasa nada.
-- =====================================================================

-- ---------- PERFILES (quién es cada usuario) ----------
create table if not exists perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

-- ---------- CLIENTES DEL FIADO ----------
create table if not exists clientes (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  telefono   text,
  notas      text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- ---------- CAMBIOS EN TABLAS QUE YA EXISTÍAN ----------
alter table ventas add column if not exists anulada          boolean not null default false;
alter table ventas add column if not exists anulada_en       timestamptz;
alter table ventas add column if not exists anulada_por      uuid;
alter table ventas add column if not exists motivo_anulacion text;
alter table ventas add column if not exists cliente_id       bigint references clientes(id) on delete set null;

alter table ventas drop constraint if exists ventas_metodo_pago_check;
alter table ventas add constraint ventas_metodo_pago_check
  check (metodo_pago in ('efectivo','transferencia','debito','fiado'));

alter table venta_items       add column if not exists precio_costo numeric(12,2) not null default 0;
alter table productos         add column if not exists acceso_rapido boolean not null default false;
alter table productos         add column if not exists creado_por uuid default auth.uid();
alter table movimientos_stock add column if not exists usuario_id uuid default auth.uid();
alter table pedidos           add column if not exists usuario_id uuid default auth.uid();

create index if not exists idx_ventas_usuario on ventas(usuario_id);

-- ---------- MOVIMIENTOS DEL FIADO ----------
create table if not exists fiado_movimientos (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references clientes(id) on delete cascade,
  tipo        text not null check (tipo in ('compra','pago')),
  monto       numeric(12,2) not null check (monto > 0),
  venta_id    bigint references ventas(id) on delete set null,
  nota        text,
  fecha       timestamptz not null default now(),
  usuario_id  uuid default auth.uid()
);

-- ---------- CIERRES DE CAJA ----------
create table if not exists cierres_caja (
  id                 bigint generated always as identity primary key,
  dia                date not null,
  de_usuario         uuid,                 -- null = los dos juntos
  total_ventas       numeric(12,2) not null default 0,
  efectivo_esperado  numeric(12,2) not null default 0,
  efectivo_contado   numeric(12,2),
  diferencia         numeric(12,2),
  notas              text,
  usuario_id         uuid default auth.uid(),   -- quién hizo el cierre
  creado_en          timestamptz not null default now()
);

-- ---------- SEGURIDAD ----------
alter table perfiles          enable row level security;
alter table clientes          enable row level security;
alter table fiado_movimientos enable row level security;
alter table cierres_caja      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clientes','fiado_movimientos','cierres_caja']
  loop
    execute format('drop policy if exists "solo_logueados" on %I', t);
    execute format('create policy "solo_logueados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- perfiles: todos ven los nombres, pero cada uno solo crea o cambia el suyo
drop policy if exists "ver_perfiles" on perfiles;
drop policy if exists "crear_mi_perfil" on perfiles;
drop policy if exists "editar_mi_perfil" on perfiles;
create policy "ver_perfiles"     on perfiles for select to authenticated using (true);
create policy "crear_mi_perfil"  on perfiles for insert to authenticated with check (id = auth.uid());
create policy "editar_mi_perfil" on perfiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- SALDO DE CADA CLIENTE ----------
create or replace view clientes_saldo with (security_invoker = true) as
select c.*,
       coalesce(sum(case when m.tipo = 'compra' then m.monto else -m.monto end), 0)::numeric(12,2) as saldo,
       max(m.fecha) as ultimo_movimiento
  from clientes c
  left join fiado_movimientos m on m.cliente_id = c.id
 group by c.id;

-- ---------- REGISTRAR VENTA (nueva versión) ----------
-- p_items: [{"producto_id": 1, "cantidad": 2}]  o para precio libre:
--          [{"producto_id": null, "nombre": "Pan", "precio": 1500, "cantidad": 1}]
drop function if exists registrar_venta(text, jsonb);

create or replace function registrar_venta(p_metodo text, p_items jsonb, p_cliente_id bigint default null)
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

  insert into ventas (total, metodo_pago, cliente_id)
  values (0, p_metodo, case when p_metodo = 'fiado' then p_cliente_id end)
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

  return v_venta_id;
end $$;

-- ---------- ANULAR VENTA ----------
-- Devuelve el stock, marca la venta como anulada y la saca del fiado.
create or replace function anular_venta(p_venta_id bigint, p_motivo text default null)
returns void
language plpgsql
security invoker
as $$
declare
  v_anulada boolean;
  v_item    record;
begin
  select anulada into v_anulada from ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v_anulada then raise exception 'Esa venta ya estaba anulada'; end if;

  for v_item in select * from venta_items where venta_id = p_venta_id and producto_id is not null
  loop
    update productos set stock = stock + v_item.cantidad where id = v_item.producto_id;
    insert into movimientos_stock (producto_id, tipo, cantidad, nota)
    values (v_item.producto_id, 'ajuste', v_item.cantidad, 'Anulación venta #' || p_venta_id);
  end loop;

  delete from fiado_movimientos where venta_id = p_venta_id;

  update ventas
     set anulada = true, anulada_en = now(), anulada_por = auth.uid(), motivo_anulacion = p_motivo
   where id = p_venta_id;
end $$;
