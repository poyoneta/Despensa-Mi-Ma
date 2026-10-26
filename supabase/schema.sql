-- =====================================================================
-- Despensa Mi-Ma · Base de datos (Supabase / PostgreSQL)
-- Pegá TODO este archivo en Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- TABLAS ----------

create table if not exists categorias (
  id      bigint generated always as identity primary key,
  nombre  text not null unique
);

create table if not exists proveedores (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  telefono    text,               -- solo números, con código de país. Ej: 5493573123456
  dia_visita  text,               -- 'lunes', 'martes', ...
  notas       text,
  creado_en   timestamptz not null default now()
);

create table if not exists productos (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  codigo_barras  text unique,
  categoria_id   bigint references categorias(id) on delete set null,
  proveedor_id   bigint references proveedores(id) on delete set null,
  precio_costo   numeric(12,2) not null default 0,
  precio_venta   numeric(12,2) not null default 0,
  stock          integer not null default 0,
  stock_minimo   integer not null default 0,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

create table if not exists ventas (
  id           bigint generated always as identity primary key,
  fecha        timestamptz not null default now(),
  total        numeric(12,2) not null,
  metodo_pago  text not null check (metodo_pago in ('efectivo','transferencia','debito')),
  usuario_id   uuid default auth.uid()
);

create table if not exists venta_items (
  id               bigint generated always as identity primary key,
  venta_id         bigint not null references ventas(id) on delete cascade,
  producto_id      bigint references productos(id) on delete set null,
  nombre           text not null,
  cantidad         integer not null check (cantidad > 0),
  precio_unitario  numeric(12,2) not null,
  subtotal         numeric(12,2) not null
);

create table if not exists movimientos_stock (
  id           bigint generated always as identity primary key,
  producto_id  bigint references productos(id) on delete cascade,
  tipo         text not null check (tipo in ('venta','ingreso','ajuste')),
  cantidad     integer not null,          -- negativo = salió, positivo = entró
  nota         text,
  fecha        timestamptz not null default now()
);

create table if not exists pedidos (
  id            bigint generated always as identity primary key,
  proveedor_id  bigint references proveedores(id) on delete set null,
  estado        text not null default 'pendiente' check (estado in ('pendiente','recibido')),
  creado_en     timestamptz not null default now(),
  recibido_en   timestamptz
);

create table if not exists pedido_items (
  id           bigint generated always as identity primary key,
  pedido_id    bigint not null references pedidos(id) on delete cascade,
  producto_id  bigint references productos(id) on delete set null,
  nombre       text not null,
  cantidad     integer not null check (cantidad > 0)
);

create index if not exists idx_ventas_fecha on ventas(fecha);
create index if not exists idx_productos_nombre on productos(nombre);

-- ---------- SEGURIDAD (RLS) ----------
-- Solo usuarios que iniciaron sesión pueden leer y escribir.

alter table categorias        enable row level security;
alter table proveedores       enable row level security;
alter table productos         enable row level security;
alter table ventas            enable row level security;
alter table venta_items       enable row level security;
alter table movimientos_stock enable row level security;
alter table pedidos           enable row level security;
alter table pedido_items      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categorias','proveedores','productos','ventas','venta_items',
                           'movimientos_stock','pedidos','pedido_items']
  loop
    execute format('drop policy if exists "solo_logueados" on %I', t);
    execute format('create policy "solo_logueados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- FUNCIONES ----------

-- Registrar una venta completa: guarda la venta, sus productos y descuenta stock.
-- p_items: [{"producto_id": 1, "cantidad": 2}, ...]
create or replace function registrar_venta(p_metodo text, p_items jsonb)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_venta_id bigint;
  v_total    numeric(12,2) := 0;
  v_item     record;
  v_prod     productos%rowtype;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  insert into ventas (total, metodo_pago) values (0, p_metodo) returning id into v_venta_id;

  for v_item in select * from jsonb_to_recordset(p_items) as x(producto_id bigint, cantidad int)
  loop
    select * into v_prod from productos where id = v_item.producto_id for update;
    if not found then
      raise exception 'Producto % no existe', v_item.producto_id;
    end if;

    insert into venta_items (venta_id, producto_id, nombre, cantidad, precio_unitario, subtotal)
    values (v_venta_id, v_prod.id, v_prod.nombre, v_item.cantidad, v_prod.precio_venta,
            v_prod.precio_venta * v_item.cantidad);

    update productos set stock = stock - v_item.cantidad where id = v_prod.id;

    insert into movimientos_stock (producto_id, tipo, cantidad, nota)
    values (v_prod.id, 'venta', -v_item.cantidad, 'Venta #' || v_venta_id);

    v_total := v_total + v_prod.precio_venta * v_item.cantidad;
  end loop;

  update ventas set total = v_total where id = v_venta_id;
  return v_venta_id;
end $$;

-- Subir (o bajar) precios por porcentaje. Filtros opcionales por categoría o proveedor.
-- Redondea a la decena más cercana. Devuelve cuántos productos cambió.
create or replace function actualizar_precios(
  p_porcentaje   numeric,
  p_categoria_id bigint default null,
  p_proveedor_id bigint default null
)
returns integer
language plpgsql
security invoker
as $$
declare v_cant integer;
begin
  update productos
     set precio_venta = round(precio_venta * (1 + p_porcentaje / 100) / 10) * 10
   where activo
     and (p_categoria_id is null or categoria_id = p_categoria_id)
     and (p_proveedor_id is null or proveedor_id = p_proveedor_id);
  get diagnostics v_cant = row_count;
  return v_cant;
end $$;

-- Marcar un pedido como recibido: suma al stock lo que llegó.
create or replace function recibir_pedido(p_pedido_id bigint)
returns void
language plpgsql
security invoker
as $$
declare v_item record;
begin
  if (select estado from pedidos where id = p_pedido_id) <> 'pendiente' then
    raise exception 'El pedido ya fue recibido';
  end if;

  for v_item in select * from pedido_items where pedido_id = p_pedido_id and producto_id is not null
  loop
    update productos set stock = stock + v_item.cantidad where id = v_item.producto_id;
    insert into movimientos_stock (producto_id, tipo, cantidad, nota)
    values (v_item.producto_id, 'ingreso', v_item.cantidad, 'Pedido #' || p_pedido_id);
  end loop;

  update pedidos set estado = 'recibido', recibido_en = now() where id = p_pedido_id;
end $$;

-- ---------- DATOS INICIALES ----------

insert into categorias (nombre) values
  ('Almacén'), ('Bebidas'), ('Golosinas'), ('Lácteos'),
  ('Limpieza'), ('Perfumería'), ('Cigarrillos'), ('Otros')
on conflict (nombre) do nothing;
