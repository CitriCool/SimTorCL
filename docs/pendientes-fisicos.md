# Prioridad: entorno físico y catálogo con procedencia

Revisión del 2 de noviembre de 2026 a partir de los problemas reportados por el usuario. Este documento conserva el alcance solicitado. La primera implementación educativa está descrita en [Entorno físico v2.4](entorno-fisico.md); los criterios de respaldo mecánico, colapso estructural y acoplamiento avanzado siguen pendientes.

## Diagnóstico confirmado

En v2.3, `src/scene.js` crea árboles y bancos como geometría visual. `src/district.js` agrega al mundo físico únicamente las viviendas generadas. Las parcelas de tipo `building` son reservas con una huella visual, no edificios. El terreno es un plano físico estático. No hay daño de suelo ni modificación del viento por obstáculos.

Los perfiles de vivienda usan categorías censales, pero sus propiedades mecánicas siguen siendo supuestos educativos, como indica `src/catalog.js`. Una fuente oficial sobre clasificación o diseño no valida por sí sola el comportamiento ante tornados.

Estos entregables se priorizaron inicialmente antes del editor manual URB-06/07. Tras la física inicial de v2.4 y la biblioteca de v2.5, la revisión del 3 de noviembre adelanta el editor didáctico y mantiene la calibración como trabajo transversal. Los mecanismos físicos pendientes conservan su alcance en el [plan integrado](editor-didactico.md).

## 1. Procedencia de cada tipo y parámetro

- Asociar cada tipología a institución, documento, edición, URL y sección/página comprobada.
- Para cada propiedad física: valor, unidad, fuente, condiciones de aplicación y nivel de respaldo. Distinguir dato publicado, valor calculado a partir de datos publicados y supuesto pendiente de calibración.
- Mantener separados tipo de vivienda, materialidad, sistema resistente, geometría y capacidad de conexiones. Un departamento es una unidad de vivienda, no una especificación estructural del edificio que lo contiene.
- No deducir resistencias ni combinaciones de materiales a partir de porcentajes censales marginales.
- Incluir esta procedencia en interfaz, configuración, ejecución e informes. Versionar cambios del modelo sin modificar los resultados históricos.

Fuentes oficiales localizadas para estudiar e integrar:

| Fuente                                                                                                                                                                                                                              | Uso previsto                                                                                 | Lo que no permite afirmar por sí sola                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [INE: Manual Censal 2024](https://censo2024.ine.gob.cl/wp-content/uploads/2025/03/Manual_Censal_CPV2024.pdf)                                                                                                                        | Definiciones de vivienda y materialidad                                                      | Masa, anclajes o resistencia al tornado                                    |
| [INE: Permisos de Edificación, resultados 2024](https://www.ine.gob.cl/sala-de-prensa/prensa/general/noticia/2025/05/22/permisos-de-edificaci%C3%B3n-disminuyeron-0-8-en-2024)                                                      | Contexto de destino y pisos de las edificaciones autorizadas                                 | Inventario completo de edificios existentes o propiedades de cada edificio |
| [MINVU: Manuales Técnicos DITEC](https://www.minvu.gob.cl/ditec/manuales-tecnicos-ditec/)                                                                                                                                           | Localizar documentos de construcción, parques, plazas y arbolado                             | Valores de fallo hasta revisar el documento y su alcance concretos         |
| [INFOR: Técnicas de Planificación y Manejo del Arbolado Urbano](https://bibliotecadigital.infor.cl/bitstream/handle/20.500.12220/13191/13191.pdf?sequence=1)                                                                        | Evaluación del riesgo de caída y relación del árbol con su entorno; incluye aportes de CONAF | Umbral universal de velocidad o resistencia de cualquier especie           |
| [INN: actualización de normas de diseño estructural](https://www.inn.cl/contenedor-de-articulos/la-division-de-normas-del-inn-presenta-los-avances-sustantivos-en-la-modernizacion-de-la-normativa-nacional-de-diseno-estructural/) | Identificar referencias técnicas, incluida NCh432:2025, y revisar sus textos y alcances      | Conformidad normativa o validación de un tornado por citar la norma        |

Estos enlaces son referencias localizadas, no una declaración de que se hayan extraído o validado coeficientes mecánicos de sus documentos completos.

## 2. Árboles y mobiliario con daño

- Identificadores persistentes por árbol, componente y objeto de mobiliario, ligados a P.
- Árboles con tronco, copa y ramas representadas según el nivel de detalle elegido; geometría de colisión y masas coherentes.
- Cargas y momentos por viento; fallo diferenciado de rama, tronco y anclaje al terreno.
- Bancos y demás mobiliario con material, piezas y anclajes propios. No reutilizar capacidades de una casa.
- Objetos liberados en el mundo físico común, con colisiones y registro de origen y receptor. El daño adicional por impacto requiere un criterio explícito, no solo detectar contacto.
- Eventos, métricas, inspección, reinicio, fotogramas, recálculo y exportaciones que incluyan estos objetos.

Criterio de aceptación: sin viento no hay liberación espontánea; una demanda inferior a la capacidad conserva el elemento y una sobrecarga suficiente produce el modo de fallo previsto. Pasar por una parcela verde no destruye automáticamente sus objetos. Una ejecución guardada reproduce sus eventos y posiciones. Las capacidades sin respaldo se identifican como supuestos, sin presentarlas como datos oficiales.

## 3. Edificios y efecto en el ensayo

- Sustituir reservas por edificios configurables en una nueva versión del catálogo: inicialmente residenciales bajos y de altura intermedia, con límites explícitos de pisos y dimensiones.
- Definir por separado estructura, fachadas, ventanas, cubierta y conexiones. Una casa escalada no constituye un modelo de edificio.
- Mantener edificios y fragmentos en el mundo común; identificar daño por edificio, piso o fachada cuando el modelo lo permita.
- Diferenciar cuatro efectos: ocupación del terreno y separación, contacto físico, daño adicional por impacto y modificación aerodinámica del viento. Esta última necesita un modelo específico de apantallamiento/canalización y su verificación.
- Mantener el daño del suelo y de fundaciones como capacidad separada; no inferirlo de la caída de fragmentos sobre el plano actual.

Criterio de aceptación: el edificio ocupa su parcela sin solapamientos indebidos, participa en los cálculos declarados y conserva sus resultados al guardar y recalcular. Los efectos todavía ausentes se indican expresamente.

## Dependencias del roadmap

Esta prioridad reúne VAL-01/04/10 (respaldo), VER-03/05/06/07 (vegetación), EDI-01/03/04/05/06/07/08 (edificios), FIS-01/02 (impactos) y CFD-03/04/08 (viento y obstáculos). Las casillas permanecen pendientes hasta implementar y verificar cada capacidad.

Avance de procedencia v2.5: [biblioteca versionada y comprobación analítica](parametros.md). Existe registro exportable de los parámetros declarados; la extracción de resistencias de fuentes completas y la validación experimental siguen pendientes.

El editor sobre parcelas está disponible desde [v2.6](editor.md). La edición no incorpora calibración, rotura adicional por impacto ni un nuevo modelo de colapso de edificios; esos pendientes se mantienen.
