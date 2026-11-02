# SimTorCL: catálogo de viviendas y daño en techo y murallas

Plan futuro consolidado: [ROADMAP.md](ROADMAP.md). Este archivo conserva el detalle de las entregas anteriores y sus pendientes.

Lista de trabajo acordada a partir de la revisión del Censo 2024 y del alcance físico actual. Actualizada el 2 de noviembre de 2026.

Estado actual: versión 2.1 implementada con tres familias y cuatro variantes, 14 combinaciones de cubierta, uniones rompibles, pérdida de soporte en paredes, elementos secundarios separados y comparación reproducible. Las grietas son trazos esquemáticos de uniones falladas; no hay cálculo continuo de tensiones. Pasaron 33 pruebas locales y la compilación, incluyendo el modo manzana. Se verificaron la escena, selectores, reinicio, fuentes, comparación, cancelación y diseño móvil en navegador. El censo aporta categorías; los valores físicos siguen siendo supuestos educativos. Detalles en [docs/modelo.md](docs/modelo.md).

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
   - [ ] Incorporar rotura de uniones por impactos de fragmentos, además de viento y pérdida de soporte.
   - [ ] Sustituir el trazado ilustrativo por geometría territorial y distribuciones respaldadas por datos.

## Entrega A: cuaderno de experimentos (v2.2)

- [x] EXP-01 a EXP-12 del [roadmap maestro](ROADMAP.md): formato, biblioteca, exportaciones, eventos, inspección, gráficos, repetición, comparación y relojes.
- [x] Verificación automatizada: 43 pruebas y compilación.
- [x] Revisión en navegador: guardar, duplicar, renombrar, importar, repetir, recuperar la ejecución previa, comparar y exportar un informe con imagen.

Las etapas de generación urbana, edificios y zonas verdes siguen pendientes según sus dependencias en el roadmap.

## Entrega B1: generador de barrio (v2.3)

- [x] Cuadrícula rectangular configurable, orientación, semilla y asignación de usos.
- [x] Parcelas identificadas, calles, veredas, accesos y retiros geométricos.
- [x] Reservas para edificios, áreas verdes visuales y parcelas libres.
- [x] Inventario, enfoque, CSV de parcelas e inclusión del plano en informes.
- [x] Esquema 2 con plano validado y compatibilidad con ejecuciones v2.2.
- [x] Pruebas de geometría, física urbana, reproducibilidad y migración.
- [ ] Pendiente: editor manual por parcela con deshacer y rehacer (URB-06/07).

## Prioridad del usuario tras probar el barrio

- [ ] Registrar fuentes oficiales por tipología y propiedad, con unidad, sección y nivel de evidencia.
- [x] Integrar árboles y mobiliario en la física, con sus modos de fallo y resultados educativos.
- [x] Crear una primera versión de edificios con estructura fija y envolvente desprendible; efectos y límites documentados.
- [x] Verificar guardado, repetición, recálculo y colisiones de los objetos nuevos. El daño adicional por impacto permanece pendiente.

El editor manual queda después de estas prioridades. Ver [alcance y fuentes localizadas](docs/pendientes-fisicos.md).

## Entrega de entorno físico (v2.4)

- [x] Registro de fuentes, evidencia, unidades y calibración pendiente.
- [x] Árboles y bancos físicos, momentos de anclaje y fallos de uniones.
- [x] Edificios residenciales de 2 a 5 pisos con núcleo fijo y envolvente desprendible.
- [x] Mundo de colisiones común, inspección, eventos y resultados separados de viviendas.
- [x] Inventario urbano versionado, esquema 3 y migración visual de archivos antiguos.
- [x] CSV por objeto y unidades de fuerza/momento en eventos; informes con procedencia.
- [ ] Calibración numérica con fuentes técnicas y validación experimental.
- [ ] Colapso estructural de edificios, rotura adicional por impacto, daño de suelo y acoplamiento aerodinámico.
