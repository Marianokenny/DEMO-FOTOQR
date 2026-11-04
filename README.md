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
npm run worker              # en otra terminal: procesa fotos y videos
```

Por defecto los archivos se guardan en disco (`STORAGE_DRIVER=local`). Para Cloudflare R2 u otro almacenamiento S3, poné `STORAGE_DRIVER=s3` y completá las variables `S3_*`.

## Pruebas

Las pruebas usan una base aparte (`fotosqr_test` por defecto, o `TEST_DATABASE_URL`). Se vacía al empezar cada corrida.

```bash
npm test
```

## Estado

Etapas 1 a 4 de 7: base, login, eventos y permisos; link y QR para invitados, carga desde celulares y procesamiento; moderación en vivo; pantalla de proyección en tiempo real.
