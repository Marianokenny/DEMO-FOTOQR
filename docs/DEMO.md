# Publicar la demo gratis desde tu compu

Con esto FOTOSQR corre en tu computadora y queda accesible desde cualquier celular con una dirección
`https://….trycloudflare.com`. No hace falta pagar nada, ni tener dominio, ni cuenta de Cloudflare.

## Lo que necesitás

- Una compu con Windows, Mac o Linux, con al menos 4 GB de RAM libres.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y abierto.
- El código: en GitHub tocá **Code → Download ZIP** y descomprimilo (o `git clone`).

## Arrancar

Abrí una terminal en la carpeta del proyecto (en Windows: clic derecho en la carpeta → *Abrir en Terminal*) y corré:

```
docker compose up -d --build
```

La primera vez tarda unos minutos porque arma todo. Después, para ver la dirección pública:

```
docker compose logs app
```

Buscá la línea `FOTOSQR listo en: https://algo-algo.trycloudflare.com`. Abrila, creá tu cuenta de organizador y armá un evento.
Los QR y los links que genere el sistema ya usan esa dirección.

Usá siempre esa dirección `https://…`, también desde tu compu. Si entrás por `http://localhost:3000`, el login no funciona
(por seguridad, la sesión solo se guarda en conexiones https).

## Apagar y volver a prender

```
docker compose stop       # apaga todo, conserva eventos, fotos y cuentas
docker compose start      # vuelve a prender
```

Si la dirección dejó de andar, reiniciá todo junto con `docker compose restart` para que la app tome la dirección nueva.

**Importante:** cada vez que se reinicia el túnel, la dirección `trycloudflare.com` cambia. Los QR impresos con la
dirección anterior dejan de funcionar. Para una demo alcanza; para un evento real conviene un dominio propio
(ver abajo).

## Hacer tu primer usuario administrador

```
docker compose exec db psql -U fotosqr -c "update \"User\" set role='admin' where email='TU-EMAIL'"
```

## Durante un evento

- La compu tiene que quedar prendida, sin suspenderse, y con buena conexión a internet: las fotos de los invitados
  suben a tu compu a través del túnel.
- Las fotos y videos quedan en un volumen de Docker (`fotosqr_data`). No lo borres con `docker compose down -v`.
- Mirá el espacio libre del disco: 300 invitados con 5 fotos cada uno son unos 3 a 5 GB.

## Más adelante: dominio propio y almacenamiento en la nube

- **Dominio propio** (por ejemplo `fotosqr.com.ar`): se crea un túnel con nombre en Cloudflare y se pone
  `APP_URL=https://tu-dominio` en un archivo `.env` al lado de `docker-compose.yml`. La dirección no cambia más.
- **Cloudflare R2**: para no depender del disco de tu compu. Se activa con `STORAGE_DRIVER=s3` y las claves `S3_*`
  (ver `.env.example`). El código ya está listo.

## Prueba de carga

Con la app corriendo:

```
docker compose exec app npm run load-test -- --guests 200 --photos 3
```

Simula 200 invitados subiendo 3 fotos cada uno al mismo tiempo, desde la misma red Wi-Fi, y mide cuánto tarda
todo en estar en pantalla. Al terminar borra el evento de prueba y sus archivos.
