# SimTorCL: catálogo de viviendas y daño en techo y murallas

Plan futuro consolidado: [ROADMAP.md](ROADMAP.md). Este archivo conserva el detalle de las entregas anteriores y sus pendientes.

Prioridad actual: [editor didáctico y pendientes integrados](docs/editor-didactico.md). El editor por arrastre o selección sobre parcelas está disponible en v2.6, con propiedades por objeto, deshacer/rehacer y guardado. La siguiente entrega amplía objetos independientes, recorridos y explicaciones visuales. La calibración técnica sigue en paralelo; los pendientes físicos se conservan.

Lista de trabajo acordada a partir de la revisión del Censo 2024 y del alcance físico actual. Actualizada el 3 de noviembre de 2026.

Entrega inicial: versión 2.1 implementada con tres familias y cuatro variantes, 14 combinaciones de cubierta, uniones rompibles, pérdida de soporte en paredes, elementos secundarios separados y comparación reproducible. Las grietas son trazos esquemáticos de uniones falladas; no hay cálculo continuo de tensiones. Pasaron 33 pruebas locales y la compilación, incluyendo el modo manzana. Se verificaron la escena, selectores, reinicio, fuentes, comparación, cancelación y diseño móvil en navegador. El censo aporta categorías; los valores físicos siguen siendo supuestos educativos. Detalles en [docs/modelo.md](docs/modelo.md).

1. **Entrega 1: base censal y definición de los modelos**
   - [x] Registrar las categorías oficiales del Censo 2024, distinguiendo tipo de vivienda y materialidad de paredes, cubierta y piso.
   - [x] Guardar las fuentes, fecha de consulta, universo de cada estadística y agrupaciones utilizadas.
   - [x] Definir un catálogo inicial de casas de albañilería, estructura liviana de tabique forrado por ambas caras y hormigón armado.
   - [x] Documentar las variantes de madera y acero dentro de estructura liviana: el censo las agrupa en una misma alternativa, por lo que su frecuencia individual requiere otra fuente.
   - [x] Definir combinaciones ilustrativas de paredes y cubiertas. Para afirmar qué combinaciones son más frecuentes, consultar tabulados o microdatos; los porcentajes separados no permiten obtener esas frecuencias.
   - [x] Identificar qué información procede del censo, qué parámetros provienen de fuentes técnicas y qué valores son supuestos educativos del simulador.
   - [x] Definir las formas de daño y sus indicadores antes de asignar umbrales físicos. Las categorías censales de materialidad no equivalen a categorías de resistencia al tornado.

2. **Entrega 2: viviendas y cubiertas configurables**
   - [x] Transformar la vivienda única en un catálogo que alimente tanto la escena 3D como el modelo físico.
   - [x] Crear geometrías y materiales diferenciados para albañilería, estructura liviana y hormigón armado.
   - [x] Permitir seleccionar cubiertas de planchas metálicas, fibrocemento, tejas/tejuelas y losa de hormigón, con combinaciones y comportamiento documentados.
   - [x] Parametrizar dimensiones, espesores, masas, fijaciones y conexiones por sistema constructivo, evitando diferencias limitadas al color o a la textura.
   - [x] Revisar las masas y los coeficientes ilustrativos actuales; documentar la calibración y las fuentes técnicas que se incorporen.
   - [x] Modelar las conexiones entre cubierta y paredes, entre paredes y con la base, incluyendo su posible separación bajo cargas definidas.
   - [x] Revisar la reducción general de fuerza aplicada actualmente a las murallas y definir cómo recibirá cargas cada sistema constructivo.

3. **Entrega 3: daño en techo, paredes y estabilidad global**
   - [x] Adaptar el desprendimiento de cubierta al material y sus uniones: una losa no debe comportarse como una plancha de zinc.
   - [x] Incorporar desprendimiento de revestimientos y separación de paneles o uniones en las estructuras livianas.
   - [x] Definir e implementar un modelo simplificado de rotura y pérdida de estabilidad para albañilería.
   - [x] Definir el alcance del modelo de hormigón armado y distinguir el comportamiento estructural del daño en elementos secundarios.
   - [x] Representar visualmente los daños que calcule la física; cualquier representación decorativa de grietas debe identificarse como tal.
   - [x] Mantener diferenciados el daño de la cubierta, el daño de las paredes y la estabilidad global, sin inferir colapso únicamente a partir de la pérdida de techo.
   - [x] Reemplazar los totales fijos de 16 planchas y 4 murallas por conteos e indicadores adecuados a cada modelo.

4. **Entrega 4: interfaz y comparación de escenarios**
   - [x] Incorporar selectores de perfil de vivienda y cubierta, con descripción del sistema representado y vínculo a la fuente censal.
   - [x] Mostrar qué parámetros son editables, sus unidades y su origen o carácter ilustrativo.
   - [x] Ampliar las estadísticas: pérdida de cubierta, paneles o piezas de pared desprendidos, conexiones falladas, desplazamiento e inclinación.
   - [x] Definir criterios explícitos para los indicadores de estabilidad y colapso dentro del modelo simplificado.
   - [x] Permitir comparar viviendas bajo la misma velocidad, radio, trayectoria y duración del tornado, documentando diferencias de geometría y exposición.
   - [x] Actualizar la explicación del modelo y conservar la usabilidad en escritorio y móvil.

5. **Entrega 5: pruebas y documentación**
   - [x] Comprobar que cada vivienda y cubierta permanezca en equilibrio sin viento, dentro de tolerancias definidas.
   - [x] Verificar que el desprendimiento, la rotura y la separación de uniones respondan a los parámetros documentados de cada perfil.
   - [x] Comprobar colisiones, ausencia de valores numéricos inválidos y estabilidad del cálculo durante escenarios de viento intenso.
   - [x] Verificar inicio, pausa, cambio de vivienda y reinicio completo de cuerpos, daños, conexiones y estadísticas.
   - [x] Comprobar que ocultar el vórtice o el radio no altere las fuerzas y que las comparaciones sean reproducibles.
   - [x] Actualizar las pruebas automáticas para evaluar cada perfil; la estabilidad de todas las paredes ante cualquier tornado no será un criterio universal de éxito.
   - [x] Revisar rendimiento y legibilidad en escritorio y móvil.
   - [x] Actualizar README, limitaciones y fuentes; ejecutar pruebas y compilación.
   - [x] Verificar en GitHub Actions la actualización publicada: [pruebas y compilación aprobadas](https://github.com/CitriCool/SimTorCL/actions/runs/41459436836).

6. **Ampliaciones posteriores**
   - [ ] Incorporar una casa de adobe como variante explícita de la categoría de materiales artesanales, con un modelo de daño propio.
   - [ ] Incorporar un escenario de vivienda de emergencia con geometría, materiales y conexiones definidos, sin asignarle propiedades solo por su tipo censal.
   - [ ] Evaluar selección y representatividad por región o comuna según los datos disponibles, conservando el universo y las fuentes de las estadísticas.
   - [ ] Evaluar departamentos y edificios como una ampliación independiente, considerando geometría, exposición y respuesta estructural distintas.

Las diferencias de comportamiento deberán corresponder a los parámetros declarados del modelo. Los datos censales aportan clasificación y representatividad; no constituyen una validación de resistencia estructural frente al viento.

Fuentes para la preparación del catálogo:

- [INE: glosario de características de las viviendas y servicios básicos, Censo 2024](https://censo2024.ine.gob.cl/wp-content/uploads/2025/05/Glosario_viviendas_y_servicios-basicos_CPV2024.pdf).
- [INE: resultados nacionales sobre características de las viviendas, 30 de mayo de 2025](https://censo2024.ine.gob.cl/censo-2024-el-611-de-los-hogares-residen-en-una-vivienda-propia-y-el-262-en-una-vivienda-arrendada/).
- [INE: portal de resultados, tabulados y microdatos del Censo 2024](https://censo2024.ine.gob.cl/resultados/).

7. **Manzana ilustrativa**
   - [x] Generar 9 o 16 casas, perfiles uniformes o mixtos y separaciones configurables.
   - [x] Compartir el mundo físico y permitir colisiones de fragmentos entre viviendas.
   - [x] Incorporar trayectorias que atraviesan la manzana, sin repetición automática.
   - [x] Mostrar resultados por casa, agregados, identificadores y color de daño por lote.
   - [x] Incorporar enfoque por casa y conservar el modo individual.
   - [x] Probar estabilidad sin viento, distribución, recorrido, reinicio y colisiones entre casas.
   - [x] Incorporar rotura de uniones por impactos de fragmentos, además de viento y pérdida de soporte (v2.8).
   - [ ] Sustituir el trazado ilustrativo por geometría territorial y distribuciones respaldadas por datos.

## Entrega A: cuaderno de experimentos (v2.2)

- [x] EXP-01 a EXP-12 del [roadmap maestro](ROADMAP.md): formato, biblioteca, exportaciones, eventos, inspección, gráficos, repetición, comparación y relojes.
- [x] Verificación automatizada: 43 pruebas y compilación.
- [x] Revisión en navegador: guardar, duplicar, renombrar, importar, repetir, recuperar la ejecución previa, comparar y exportar un informe con imagen.

Las ampliaciones de generación urbana, edificios y zonas verdes se detallan en las entregas siguientes y en el roadmap.

## Entrega B1: generador de barrio (v2.3)

- [x] Cuadrícula rectangular configurable, orientación, semilla y asignación de usos.
- [x] Parcelas identificadas, calles, veredas, accesos y retiros geométricos.
- [x] Reservas para edificios, áreas verdes visuales y parcelas libres.
- [x] Inventario, enfoque, CSV de parcelas e inclusión del plano en informes.
- [x] Esquema 2 con plano validado y compatibilidad con ejecuciones v2.2.
- [x] Pruebas de geometría, física urbana, reproducibilidad y migración.
- [x] Editor manual por parcela con deshacer y rehacer (URB-06/07), disponible desde v2.6.

## Prioridad del usuario tras probar el barrio

- [ ] Registrar fuentes oficiales por tipología y propiedad, con unidad, sección y nivel de evidencia.
- [x] Integrar árboles y mobiliario en la física, con sus modos de fallo y resultados educativos.
- [x] Crear una primera versión de edificios con estructura fija y envolvente desprendible; efectos y límites documentados.
- [x] Verificar guardado, repetición, recálculo y colisiones de los objetos nuevos.

La física inicial y la biblioteca ya están disponibles en v2.4/v2.5. El editor manual está disponible en v2.6; la calibración y los mecanismos físicos restantes continúan según el [plan integrado](docs/editor-didactico.md). Ver también [alcance y fuentes localizadas](docs/pendientes-fisicos.md).

## Entrega de entorno físico (v2.4)

- [x] Registro de fuentes, evidencia, unidades y calibración pendiente.
- [x] Árboles y bancos físicos, momentos de anclaje y fallos de uniones.
- [x] Edificios residenciales de 2 a 5 pisos con núcleo fijo y envolvente desprendible.
- [x] Mundo de colisiones común, inspección, eventos y resultados separados de viviendas.
- [x] Inventario urbano versionado, esquema 3 y migración visual de archivos antiguos.
- [x] CSV por objeto y unidades de fuerza/momento en eventos; informes con procedencia.
- [ ] Calibración numérica con fuentes técnicas y validación experimental.
- [ ] Colapso estructural de edificios, detección continua entre fragmentos móviles, daño de suelo y acoplamiento aerodinámico.

## Biblioteca y comprobación (v2.5)

- [x] Biblioteca `parameters-1`: 73 parámetros base y 16 del entorno, con unidades, origen, aplicación y estado de evidencia.
- [x] Exploración por grupo y búsqueda; exportación completa JSON/CSV desde Parámetros y fuentes.
- [x] Copia de procedencia en configuraciones, ejecuciones e informes; esquema 4 y migración sin atribución retrospectiva.
- [x] Caso analítico con 10 verificaciones de presión, cargas, unidades y límites, errores y tolerancias exportables.
- [x] Fuentes de ecuaciones separadas de propiedades; no se atribuyen resistencias a la NASA ni al Censo.
- [x] 68 pruebas y compilación; compatibilidad exacta de una ejecución física v2.4 dañada.
- [ ] Extraer propiedades de fuentes técnicas completas y definir su aplicación por tipología.
- [ ] Primer caso de validación física independiente, métricas de error y estudios de sensibilidad.

Detalle: [biblioteca, caso y límites](docs/parametros.md). VAL-01/02/04/10 mantienen avance parcial; esta entrega no completa la calibración física.

## Editor de manzanas (v2.6)

- [x] Borrador 3D independiente, paleta y arrastre de casas, edificios y parques a parcelas libres.
- [x] Movimiento, giro, duplicado, eliminación, deshacer/rehacer y colocación por clic, toque y teclado.
- [x] Propiedades por objeto, identidades persistentes y reglas contra destinos ocupados o fuera del plano.
- [x] Guardado en biblioteca/JSON, esquema 5, repetición, recálculo y migración histórica.
- [x] Conservación de la ejecución anterior al aplicar mediante guardado explícito; edición bloqueada durante repetición.
- [x] 78 pruebas, compilación y revisión en navegador de edición, persistencia, respaldo y móvil.
- [x] Árboles y bancos independientes, recorridos dibujados, guía inicial y explicación visual ampliada (B3, v2.7).
- [ ] Calles y parcelas de forma libre (B4), además de los pendientes físicos y de validación.

Detalle y ejemplo: [editor v2.6](docs/editor.md).

## Entregas integradas — estado actual

- [x] **B2 · Construir:** paleta de casas, edificios y parques, colocación por arrastre o selección, ajuste a parcelas, prevención de solapamientos, selección y transformación, propiedades por objeto, deshacer/rehacer y guardado compatible. URB-06/07, UX-01/02/06, PRO-01/08/09.
- [x] **B3 · Simular y entender:** árboles y bancos independientes, ejemplos guiados, trayectorias dibujadas y controles de duración/intensidad; explicación de eventos, revisión visual y comparación sobre el mismo plano editado. URB-08/09/12, VER-02/04, FIS-08/09, UX-03/04/05, PRO-12.
- [ ] **C · Física:** FIS-01/02 listos en v2.8. Primeros alcances de FIS-04 en v2.9 y FIS-03 en v2.10. Quedan pendientes calibración, fragmentación física, detección continua entre piezas móviles, FIS-05 a FIS-07/11, EDI y VER.
- [ ] **D · Transversal desde B2:** fuentes técnicas por parámetro, calibración, caso físico de referencia, errores, sensibilidad y estabilidad. VAL-01 a VAL-05/08/10.
- [ ] **B4 / E · Escala y territorio:** calles y terrenos libres, mayor catálogo, rendimiento, datos por región/comuna e inventarios geográficos. URB-03/11, EDI, VER, GEO y PRO.
- [ ] **E / F · Análisis avanzado:** incertidumbre y fragilidad, viento urbano/CFD, suelo y fundaciones y modelos de consecuencias. VAL-06/07/09, CFD, FIS-12, EDI-11, GEO-07 y CON.

La navegación prevista será **Construir → Simular → Entender**. Los parámetros avanzados se despliegan cuando se necesitan; fuentes, supuestos y alcance permanecen accesibles. B2 y B3 ya están implementadas; las casillas abiertas conservan el trabajo pendiente. Desglose y criterios de cierre: [plan integrado](docs/editor-didactico.md).

## Taller de simulación y explicación (v2.7)

- [x] Árboles y bancas independientes, nueve posiciones por parcela, anclaje educativo del árbol y reglas contra solapamientos.
- [x] Cuatro ejemplos sintéticos modificables; guía y ayudas de construcción, simulación e interpretación.
- [x] Recorrido dibujado, intensidad, avance y duración guardados; detención exacta del cálculo al cumplir el tiempo.
- [x] Selección de piezas y objetos; explicaciones de sobrecarga o pérdida de soporte basadas en eventos, con acceso a la línea de tiempo.
- [x] Geometría inicial/calculada y barras A/B de cubierta perdida, conservando el plano al variar refuerzo.
- [x] Esquema 6, descriptores de escenario y entorno, exportaciones y compatibilidad exacta con una ejecución v2.6 dañada.
- [x] 88 pruebas, compilación y revisión del flujo en navegador.
- [x] El primer tramo de C incorpora roturas por impacto opcionales y cadenas causales.
- [ ] D mantiene calibración y validación como trabajo transversal. Calles libres, catálogo ampliado, ráfagas y perfil vertical siguen pendientes.

Guía y alcance: [taller v2.7](docs/taller.md).
