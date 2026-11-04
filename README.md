# FOTOSQR Eventos

Plataforma para que los invitados de un evento suban fotos y videos desde el celular (por QR, sin app ni cuenta) y se proyecten en vivo en la pantalla del salón.

## Requisitos

- Node 22
- PostgreSQL 16

## Puesta en marcha

```bash
cp .env.example .env        # completar DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev                 # http://localhost:3000
```

## Pruebas

Las pruebas usan una base aparte (`fotosqr_test` por defecto, o `TEST_DATABASE_URL`). Se vacía al empezar cada corrida.

```bash
npm test
```

## Estado

Etapa 1 de 7: base del proyecto, login de organizadores, eventos y permisos.
