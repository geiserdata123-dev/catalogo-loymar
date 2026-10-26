# LOYMAR Catálogo v23 — repositorio fotográfico recuperado

## Base de productos
- Archivo base: `data para catologo1.xlsx`
- Productos cargados: **1,339**
- Códigos de la primera columna únicos: **1,339**
- Códigos internos únicos: **1,339**

## Fotografías
- Repositorio recibido (`productos.rar`): **900 archivos `.webp`**; los 900 pasan la validación de formato.
- Fotografías declaradas en la base actual: **684**. Todas tienen un archivo existente.
- La carpeta `productos/` contiene **964** fotografías: **684 declaradas**, **63 no declaradas pero con un código interno actual** y **217 sin producto actual coincidente**. Las 63 no declaradas no se muestran hasta ser auditadas y aprobadas.
- La foto `5.webp` fue verificada y declarada para su producto. La asociación de `1466.webp` fue bloqueada porque muestra otro producto; la fotografía se conserva para auditoría, pero no se exhibe.
- Las imágenes repetidas se registran en `Reporte_Auditoria_Fotografias_V23.csv`: **6 aprobadas como genéricas**, **1 bloqueada** y **42 pendientes de revisión visual**.

Las fotos sin coincidencia no se asignan por aproximación para evitar mostrar una imagen en un producto equivocado. Consulta `Reporte_Fotografias_LOYMAR_V23.csv` para el inventario original y `Reporte_Auditoria_Fotografias_V23.csv` para el estado actual de imágenes repetidas o revisadas.

## Cómo abrir
1. Descarga y extrae `LOYMAR_CATALOGO_V23_REPOSITORIO_900_FOTOS.zip`.
2. Entra en la carpeta `LOYMAR_CATALOGO_V23`.
3. Abre `index.html` para usar el catálogo o `admin.html` para administrar la base y las imágenes.
4. Conserva tu carpeta v21/v22 original hasta comprobar la nueva versión en tu computadora.

## Compatibilidad y caché
Esta versión utiliza una clave local nueva (`LOYMAR_CATALOG_LOCAL_V23`) y una caché de servicio nueva (`loymar-v23`) para que no se reutilice directamente la base/caché de versiones anteriores. La base `data/catalog.js`, `data/catalog.json` y `data/base_maestra.csv` está incluida.

La comprobación entregada valida estructura del ZIP, sintaxis de los scripts, cantidad de productos, duplicados, y existencia de todos los archivos referenciados. No se pudo completar una prueba visual automatizada del navegador en este entorno; conviene abrir `index.html` en tu PC y confirmar que el contador marque 1,339 y que una tarjeta con foto se muestre correctamente.
