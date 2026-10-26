# Despensa Mi-Ma · App de gestión

Web para manejar la despensa desde el celular o la computadora:

- **Inicio**: ventas del día (por forma de pago), productos que se están acabando, el más vendido y qué proveedor pasa mañana.
- **Caja**: escanear con la cámara (o con lector USB), buscar por nombre, sumar y restar, elegir forma de pago y cobrar. Descuenta el stock solo.
- **Stock**: lista con búsqueda y filtros por categoría o "bajo stock", alta y edición de productos, sumar mercadería que llegó y **subir precios por porcentaje** (todo, por categoría o por proveedor).
- **Proveedores**: datos de cada uno, armar el pedido con lo que falta y **mandarlo por WhatsApp**. Cuando llega, tocás "Llegó el pedido" y se suma al stock.

- **Ventas**: historial por día, quién vendió cada cosa, **anular una venta** (devuelve el stock) y **cerrar caja** (cuánta plata tiene que haber y si sobra o falta).
- **Fiado**: libreta de clientes con lo que deben, lo que llevaron y lo que pagaron. Se anota solo al cobrar "Fiado" en la caja.
- **Reportes**: ventas por período, por día, por forma de pago, productos más vendidos y ganancia aproximada.
- **Mercado Pago**: cobro con QR desde la caja (se registra solo) y lista de cobros y transferencias que entran a la cuenta.
- **Clientes**: nombre, apellido, apodo, DNI y WhatsApp, en cualquier venta.
- **Mateo y Mika**: cada uno entra con su usuario y todo queda a su nombre. En Inicio, Ventas, Cierre y Reportes se ve **cada uno por separado y los dos juntos**.

Se puede **instalar como app** en el celular: desde Chrome, menú ⋮ → "Agregar a pantalla de inicio".

---

## Actualización 2 (si ya tenías la versión anterior funcionando)

1. **Copiá los archivos nuevos** encima de tu carpeta del proyecto, reemplazando todo (`src`, `supabase`, `package.json`, `README.md`). **No borres** tu `.env` ni `node_modules`.
2. **Actualizá la base:** en Supabase → **SQL Editor → New query**, pegá todo `supabase/actualizacion-02.sql` y tocá **Run**. No borra nada de lo que ya cargaste.
3. **Usuarios:** en **Authentication → Users → Add user** creá uno para Mateo y otro para Mika (cada uno con su email, marcando **Auto Confirm User**). Si ya tenías uno, usalo para uno de los dos.
4. La **primera vez** que cada uno entra, la app pregunta "¿Quién sos?": eligen su nombre y listo.
5. En la terminal de VS Code (hay una librería nueva para leer Excel):

```bash
npm install
npm run dev
```

6. Cuando lo probaste, subilo para que Render lo publique:

```bash
git add .
git commit -m "Usuarios, ventas, cierre de caja, fiado, reportes e importar Excel"
git push
```

> Las ventas que hiciste antes de esta actualización aparecen como "Sin nombre" en los resúmenes, porque todavía no existían los perfiles.

---

## Actualización 3 · Mercado Pago y datos de clientes

Qué agrega:
- En la **caja**, la forma de pago **"QR MP"**: aparece un QR con el monto exacto, el cliente lo escanea y la venta se registra sola cuando paga.
- Sección **Mercado Pago**: trae lo que entró a la cuenta (QR y transferencias por alias/CVU) para registrarlo como venta o unirlo a una venta que ya cargaron.
- **Cliente en cualquier venta** (no solo fiado): nombre, apellido, apodo, DNI y WhatsApp. Todo opcional.

### 1. Código y base de datos
1. Copiá los archivos nuevos encima de tu proyecto (sin borrar `.env` ni `node_modules`).
2. Supabase → **SQL Editor** → pegá `supabase/actualizacion-03.sql` → **Run**.
3. Terminal: `npm install` (hay una librería nueva para dibujar el QR) y `npm run dev`.

### 2. Sacar el Access Token de Mercado Pago (para probar, con TU cuenta)
1. Entrá a **mercadopago.com.ar/developers** con tu cuenta de Mercado Pago → **Tus integraciones → Crear aplicación**.
2. Nombre: `Despensa Mi-Ma`. Cuando pregunte qué vas a integrar, elegí **pagos presenciales / Código QR**.
3. Entrá a la aplicación → **Credenciales de producción**. Si te pide activarlas, completá rubro y sitio web (podés poner la dirección de Render).
4. Copiá el **Access Token** (empieza con `APP_USR-...`). **Es secreto**: no lo pongas en el `.env`, ni en GitHub, ni lo mandes por chat.

### 3. Publicar la función en Supabase
La web no puede tener el token (cualquiera lo vería), así que lo guarda una función de Supabase que es la única que habla con Mercado Pago.

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre: exactamente `mercadopago`.
3. Borrá el código de ejemplo, pegá todo `supabase/functions/mercadopago/index.ts` y tocá **Deploy**.
4. Supabase → **Edge Functions → Secrets** → **Add new secret**: nombre `MP_ACCESS_TOKEN`, valor: el Access Token. Guardá.

> Con la terminal también se puede: `npx supabase login`, `npx supabase link`, `npx supabase functions deploy mercadopago` y `npx supabase secrets set MP_ACCESS_TOKEN=APP_USR-...`.

### 4. Crear la caja y probar
1. En la app → **Mercado Pago**. Tiene que decir "Conectado a la cuenta de (tu nombre)".
2. Completá la dirección del local (el botón "Usar mi ubicación" llena latitud y longitud) → **Crear caja**.
3. Andá a la **Caja**, agregá algo barato (por ejemplo "Varios" $10), elegí **QR MP** → **Mostrar QR**.
4. Pagalo **desde otra cuenta** de Mercado Pago o desde la app de un banco (no podés pagarte a vos mismo). En unos segundos dice "¡Pagado!" y la venta queda registrada.
5. Mandate una transferencia a tu alias, andá a **Mercado Pago → Actualizar** y fijate que aparezca.

### 5. Pasar a la cuenta de Mika
1. Mika hace el paso 2 con **su** cuenta y te pasa el Access Token (en persona o que lo cargue ella).
2. En Supabase → **Edge Functions → Secrets**, editá `MP_ACCESS_TOKEN` y poné el de Mika.
3. En la app → **Mercado Pago** → completar la dirección → **Crear caja** (cada cuenta tiene su propia caja).

No hay que cambiar nada del código ni volver a publicar en Render.

> **Datos de clientes:** el DNI y el teléfono son opcionales. Guarden solo lo que necesitan (por ejemplo, para el fiado) y no compartan esa información con nadie.

Tecnologías: React + Vite, Supabase (base de datos y login), Render (hosting).

---

## Paso 1 · Abrir el proyecto

1. Descomprimí el .zip y abrí la carpeta `despensa-mi-ma` en **VS Code** (Archivo → Abrir carpeta).
2. Necesitás **Node.js 20 o más nuevo**. En la terminal de VS Code (Ver → Terminal) revisá con `node -v`. Si no lo tenés, bajalo de nodejs.org (versión LTS).
3. En la terminal:

```bash
npm install
```

## Paso 2 · Crear la base de datos en Supabase

1. Entrá a supabase.com → **New project**. Ponele de nombre `despensa-mi-ma`, elegí una contraseña y la región **South America (São Paulo)**.
2. Cuando termine de crearse, andá a **SQL Editor → New query**.
3. Abrí el archivo `supabase/schema.sql` de este proyecto, copiá **todo**, pegalo y tocá **Run**. Tiene que decir "Success".
4. Creá el usuario para entrar a la app: **Authentication → Users → Add user → Create new user**. Poné un email y contraseña y marcá **Auto Confirm User**. (Podés crear uno para cada persona que atienda.)
5. Copiá los datos de conexión: **Project Settings → API** (o el botón **Connect**):
   - **Project URL**
   - **anon / publishable key** (la pública, NUNCA la `service_role` ni la secret key)

## Paso 3 · Conectar y probar en tu compu

1. Copiá el archivo `.env.example` y renombrá la copia a `.env`.
2. Pegá ahí la URL y la key:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_KEY=eyJ... (o sb_publishable_...)
```

3. Arrancá la app:

```bash
npm run dev
```

4. Abrí http://localhost:5173 y entrá con el usuario que creaste.

> Para probarla en el celular en tu misma red WiFi, la terminal también muestra una dirección tipo `http://192.168.x.x:5173`. Ojo: la **cámara no funciona por esa dirección** (los navegadores la piden con https). La cámara sí funciona en `localhost` y en Render.

**Primeros pasos dentro de la app:** cargá los proveedores → después los productos (con su proveedor, precio y "avisar cuando queden") → ya podés vender.

## Paso 4 · Subir a GitHub

1. En github.com creá un repositorio nuevo **privado** llamado `despensa-mi-ma` (sin README).
2. En la terminal de VS Code:

```bash
git init
git add .
git commit -m "Primera versión de la app"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/despensa-mi-ma.git
git push -u origin main
```

El `.env` **no se sube** (está en `.gitignore`), así tus claves quedan en tu compu.

## Paso 5 · Publicar en Render

1. En render.com → **New → Static Site** y conectá el repo `despensa-mi-ma`.
2. Configuración:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
3. En **Environment** agregá las dos variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (los mismos valores del `.env`).
4. Después de crearlo, en **Redirects/Rewrites** agregá una regla: Source `/*`, Destination `/index.html`, Action **Rewrite**. (Sin esto, si recargás la página en /stock da error 404.)
5. Tocá **Deploy**. Te queda una dirección tipo `https://despensa-mi-ma.onrender.com`.

> También podés usar **New → Blueprint** y Render lee el archivo `render.yaml`, que ya trae todo esto configurado (solo te pide las dos variables).

Cada vez que hagas `git push`, Render vuelve a publicar solo.

---

## Estructura

```
despensa-mi-ma/
├─ public/             logo blanco e íconos de la app (fondo naranja liso)
├─ supabase/schema.sql tablas, seguridad y funciones (venta, precios, pedidos)
├─ src/
│  ├─ main.jsx         punto de entrada
│  ├─ App.jsx          login y rutas
│  ├─ styles.css       colores de la marca y diseño (celular y compu)
│  ├─ lib/             conexión a Supabase, formatos ($, fechas) y consultas
│  ├─ components/      menú, ventanas, lector de códigos, avisos, íconos
│  └─ pages/           Inicio, Caja, Stock, Proveedores, Pedido, Login
├─ render.yaml         configuración de Render
└─ vite.config.js      Vite + instalación como app (PWA)
```

## Colores

Están todos arriba de `src/styles.css`, en `:root`. El naranja de la marca es `--naranja` (#FF5A0F) y el de los botones `--primario` (#C23B00), un poco más oscuro para que el texto blanco se lea bien.

## Problemas comunes

- **"Falta configurar Supabase"**: no existe el `.env` o le falta algún dato. Después de crearlo, cortá `npm run dev` (Ctrl+C) y volvelo a correr.
- **"Email o contraseña incorrectos"**: revisá que el usuario esté confirmado (Auto Confirm) en Supabase.
- **Error "permission denied" o "row-level security"**: no corriste todo el `schema.sql`, o no iniciaste sesión.
- **La cámara no abre**: tiene que ser https (Render) o localhost, y darle permiso al navegador.
- **En Render no aparecen los datos**: faltan las variables de entorno. Agregalas y hacé **Manual Deploy → Clear build cache & deploy**.
