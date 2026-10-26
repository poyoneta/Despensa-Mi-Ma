-- =====================================================================
-- Despensa Mi-Ma · Actualización 04
-- Cliente automático con los datos de quien pagó por Mercado Pago.
-- Supabase > SQL Editor > New query > pegar todo > Run
-- =====================================================================

create index if not exists idx_clientes_dni on clientes(dni);

-- Busca un cliente por DNI (o por nombre si no hay DNI) y si no existe lo crea.
-- Devuelve el id del cliente, o null si no hay datos suficientes.
create or replace function cliente_desde_pagador(p_nombre text, p_doc text)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_id       bigint;
  v_doc      text := nullif(regexp_replace(coalesce(p_doc, ''), '\D', '', 'g'), '');
  v_nombre   text := nullif(trim(coalesce(p_nombre, '')), '');
  v_primero  text;
  v_resto    text;
begin
  if v_doc is not null then
    select id into v_id from clientes where dni = v_doc order by activo desc, id limit 1;
    if found then
      -- si estaba oculto, lo vuelve a mostrar
      update clientes set activo = true where id = v_id and not activo;
      return v_id;
    end if;
  end if;

  if v_nombre is null and v_doc is null then
    return null;
  end if;

  if v_doc is null then
    -- sin DNI: solo reutiliza si hay uno con exactamente el mismo nombre
    select id into v_id from clientes
     where lower(trim(nombre || ' ' || coalesce(apellido, ''))) = lower(v_nombre)
     order by id limit 1;
    if found then return v_id; end if;
  end if;

  v_primero := split_part(coalesce(v_nombre, ''), ' ', 1);
  v_resto   := nullif(trim(substr(coalesce(v_nombre, ''), length(v_primero) + 1)), '');

  insert into clientes (nombre, apellido, dni, notas)
  values (coalesce(nullif(v_primero, ''), 'Cliente ' || v_doc), v_resto, v_doc, 'Creado automáticamente desde Mercado Pago')
  returning id into v_id;
  return v_id;
end $$;

-- Para las ventas que vinieron de Mercado Pago y quedaron sin cliente:
-- les pone el cliente con los datos de quien pagó. Devuelve cuántas completó.
create or replace function asignar_clientes_desde_cobros()
returns integer
language plpgsql
security invoker
as $$
declare
  v_cobro   record;
  v_cliente bigint;
  v_cant    integer := 0;
begin
  for v_cobro in
    select c.venta_id, c.pagador_nombre, c.pagador_doc
      from cobros_mp c
      join ventas v on v.id = c.venta_id
     where v.cliente_id is null
       and not v.anulada
       and (c.pagador_doc is not null or c.pagador_nombre is not null)
  loop
    v_cliente := cliente_desde_pagador(v_cobro.pagador_nombre, v_cobro.pagador_doc);
    if v_cliente is not null then
      update ventas set cliente_id = v_cliente where id = v_cobro.venta_id;
      v_cant := v_cant + 1;
    end if;
  end loop;
  return v_cant;
end $$;
