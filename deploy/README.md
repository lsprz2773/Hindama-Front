# Despliegue del frontend en su EC2

Cómo se pone el frontend (Next.js como BFF) en su propia instancia, junto a la del backend. Complementa la sección 6.8 de `deploy/PROCEDIMIENTO.md` del backend. Lo que ya existe en AWS (VPC, grupos de seguridad, RDS, la EC2 del backend) no se repite aquí.

## Qué se despliega

| Pieza                             | Qué es                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                      | Imagen de Next.js en modo `standalone`, usuario `node`, sin secretos                                                                |
| `deploy/compose.yaml`             | Dos servicios: `frontend` (Next.js, sistema de archivos de solo lectura, `cap_drop: ALL`) y `caddy` (TLS público con Let's Encrypt) |
| `deploy/start.sh`                 | Lee los secretos de SSM y los deja en `/run/hindama/frontend.env` (tmpfs, modo 600); después levanta los contenedores               |
| `deploy/hindama-frontend.service` | Unidad de systemd que ejecuta `start.sh` en cada arranque                                                                           |

El navegador solo habla con Caddy por HTTPS. Next.js llama a la API del backend por `https://backend.internal:8443` (red privada, certificado de la CA interna de Caddy del backend) y a Cognito por internet.

## Antes de empezar

1. **Un dominio** que apunte a la IP elástica del frontend (registro A). La cookie de sesión es `__Host-`: exige HTTPS y no funciona por IP.
2. **La EC2 del backend funcionando** (`GET /health` por `backend.internal:8443` responde 200).
3. **El User Pool y el cliente de Cognito.** El inicio de sesión lo hace el servidor de Next.js directamente contra Cognito con el secreto del cliente: no hay redirección ni URL de retorno que registrar. Hoy el despliegue usa el pool de desarrollo `hindama-dev`; usar otro es solo cambiar `COGNITO_CLIENT_ID` y el secreto.

## 1. Parámetros en SSM

Con el entorno `dev` (cámbialo si usas otro):

```bash
# Secreto del cliente de Cognito (si no se guardó ya en la sección 3 del procedimiento del backend)
aws ssm put-parameter --name /hindama/dev/frontend/cognito-client-secret --type SecureString --value '<secreto>'

# Llave AES-256 de la cookie de sesión: 32 bytes aleatorios en base64
aws ssm put-parameter --name /hindama/dev/frontend/session-key --type SecureString \
  --value "$(openssl rand -base64 32)"
```

Rotar `session-key` cierra todas las sesiones abiertas, nada más.

## 2. La EC2 del frontend

- Subred **pública**, grupo de seguridad `hindama-sg-fe` (80 y 443 desde internet; el 8443 del backend ya acepta a este grupo).
- Instancia `t4g` (arm64, como la del backend) con Docker, el plugin de Compose, Git y la AWS CLI instalados. Las imágenes base (`node`, `caddy`) son multiarquitectura.
- **IP elástica** `hindama-frontend-eip`, asociada a la instancia. Agrégala a `own-ip-addresses` del backend (`/hindama/backend/own-ip-addresses`, lista JSON) y reinicia el backend: así nadie puede apuntar la plataforma contra sí misma (ADR-008).
- **Rol de la instancia** con `ssm:GetParameter` **solo** sobre `/hindama/dev/frontend/*` y `kms:Decrypt` de la clave que protege esos parámetros. No debe poder leer `/hindama/backend/*`. Verifica con el simulador de IAM como en la sección 6 del procedimiento del backend.
- `start.sh` lee SSM desde el servidor y no desde el contenedor, así que no hace falta cambiar el límite de saltos de IMDS.

## 3. Copiar el código y la CA del backend

```bash
sudo mkdir -p /opt/hindama /etc/hindama
sudo git clone https://github.com/lsprz2773/Hindama-Front.git /opt/hindama/frontend
cd /opt/hindama/frontend && sudo git checkout <sha completo de dev>

# Raíz de la CA interna del backend (la del paso 6.7 del procedimiento del backend)
sudo cp caddy-root.crt /etc/hindama/caddy-root.crt
```

La raíz se obtiene en la EC2 del backend: `docker cp hindama-caddy-1:/data/caddy/pki/authorities/local/root.crt caddy-root.crt`. Es un certificado público; se puede mover por Session Manager o `scp`.

## 4. Configuración pública

Crea `/etc/hindama/frontend.conf` (sin secretos):

```bash
HINDAMA_ENV=dev
COGNITO_REGION=us-east-1
COGNITO_CLIENT_ID=<client id del pool>
HINDAMA_DOMAIN=hindama.ejemplo.mx
HINDAMA_BACKEND_IP=<IP privada de la EC2 del backend>
```

## 5. Arrancar

```bash
sudo chmod +x /opt/hindama/frontend/deploy/start.sh
sudo cp /opt/hindama/frontend/deploy/hindama-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hindama-frontend
```

La primera vez construye la imagen en la instancia (varios minutos). Caddy pide el certificado cuando el dominio ya resuelve a la IP elástica.

## 6. Verificar

| Comprobación                                          | Esperado                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `curl -s https://<dominio>/api/health`                | `{"status":"ok"}`                                                                                              |
| `curl -sI https://<dominio>/`                         | `Strict-Transport-Security`, `Content-Security-Policy` y `X-Content-Type-Options: nosniff`; sin `X-Powered-By` |
| Registrarse y entrar desde el navegador               | Se llega a «Proyectos»; la cookie `__Host-…` es `HttpOnly`, `Secure` y `SameSite=Lax`                          |
| Crear un proyecto con una URL pública                 | Se crea; con `http://127.0.0.1` responde 422 `url.destination_not_allowed`                                     |
| `docker compose -f deploy/compose.yaml logs frontend` | Sin errores `[bff] Falta la variable…` ni de certificado                                                       |
| En el backend: bitácora de auditoría                  | `source_ip` es la del navegador, no la de la EC2 del frontend (RF-82)                                          |

## Actualizar

```bash
cd /opt/hindama/frontend && sudo git fetch && sudo git checkout <sha nuevo>
sudo systemctl restart hindama-frontend
```

Un cambio de contrato exige actualizar primero el backend (ADR-016) y después el frontend.

## Problemas comunes

| Síntoma                                   | Causa probable                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `[bff] Falta la variable de entorno …`    | `/run/hindama/frontend.env` incompleto: revisa `frontend.conf` y los parámetros de SSM |
| Errores de certificado al llamar a la API | Falta `NODE_EXTRA_CA_CERTS` o `/etc/hindama/caddy-root.crt` no es la raíz del backend  |
| 403 `csrf.invalid` o `origin` rechazado   | `HINDAMA_DOMAIN` no coincide con el dominio con el que se entra                        |
| Sin sesión tras iniciar                   | Se entró por HTTP o por IP (la cookie `__Host-` lo impide)                             |
| `AccessDenied` al arrancar                | El rol de la instancia no tiene permiso sobre `/hindama/<entorno>/frontend/*`          |
| La caché de Next no se escribe            | El volumen `next-cache` debe ser del usuario `node` (uid 1000)                         |
