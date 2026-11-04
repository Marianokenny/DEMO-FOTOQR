# FOTOSQR Eventos

Plataforma para que los invitados de un evento suban fotos y videos desde el celular (por QR, sin app ni cuenta) y se proyecten en vivo en la pantalla del salón.

## Requisitos

- Node 22
- PostgreSQL 16
- Redis 7 (cola de procesamiento y avisos en vivo)
- ffmpeg y ffprobe (conversión de videos)

## Puesta en marcha

```bash
cp .env.example .env        # completar DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev                 # http://localhost:3000
npm run worker              # en otra terminal: procesa fotos y videos y, cada 15 min, borra los archivos de eventos vencidos
```

Por defecto los archivos se guardan en disco (`STORAGE_DRIVER=local`). Para Cloudflare R2 u otro almacenamiento S3, poné `STORAGE_DRIVER=s3` y completá las variables `S3_*`.

## Pruebas

Las pruebas usan una base aparte (`fotosqr_test` por defecto, o `TEST_DATABASE_URL`). Se vacía al empezar cada corrida.

```bash
npm test
```

## Publicar la demo gratis

Ver [docs/DEMO.md](docs/DEMO.md): Docker Compose en tu compu más un túnel de Cloudflare, sin costo.

## Prueba de carga

```
npm run load-test -- --guests 200 --photos 3
```

Resultado de referencia (4 núcleos, almacenamiento local): 200 invitados subiendo 3 fotos de ~3,8 MB a la vez
desde la misma IP: 600 fotos (2,3 GB) subidas en ~21 s, sin errores, y todas procesadas y en pantalla en ~2 min 45 s.

## Estado

Las 7 etapas del plan están hechas: base, login, eventos y permisos; link y QR para invitados, carga desde celulares
y procesamiento; moderación en vivo; pantalla de proyección en tiempo real; editor de apariencia; galería con
descarga y vencimiento; seguridad, prueba de carga y publicación con Docker.
