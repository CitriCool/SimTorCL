# SimTorCL: roadmap de funcionalidades

Plan maestro actualizado el 3 de noviembre de 2026. Reúne las funcionalidades conversadas, lo ya implementado y la incorporación de edificios y zonas verdes a la generación urbana 3D. Es un plan de desarrollo: las casillas pendientes no representan capacidades disponibles.

Objetivo: construir un laboratorio educativo que permita generar entornos urbanos, experimentar con viento y daños, explicar los resultados y repetir las comparaciones. La evolución hacia análisis técnico dependerá de datos y validación específicos.

Prioridades: **P0** base necesaria para trabajar con confianza; **P1** ampliación del laboratorio; **P2** mayor respaldo físico y territorial; **P3** análisis avanzado sujeto a datos. La secuencia expresa dependencias, no fechas ni estimaciones de duración.

## Prioridad actual: editor didáctico y respaldo técnico

Tras probar v2.3 se priorizó el [entorno físico y el catálogo con procedencia](docs/pendientes-fisicos.md). En v2.4 se incorporó una primera física urbana y en v2.5 una biblioteca de parámetros. Con esa base disponible, se adelanta el editor didáctico URB-06/07: construir la manzana arrastrando elementos, preparar el tornado y comprender los daños. La calibración y validación continúan como trabajo transversal; no es necesario completarlas para editar escenarios educativos, pero su nivel de respaldo debe permanecer visible.

Primera implementación v2.4: [entorno físico urbano](docs/entorno-fisico.md). Incluye árboles y bancos con uniones rompibles, edificios residenciales de 2 a 5 pisos con núcleo fijo y envolvente desprendible, colisiones, registro y procedencia. Las capacidades mecánicas siguen siendo educativas. Permanecen pendientes calibración técnica, colapso estructural de edificios, detección continua entre fragmentos móviles, daño de suelo y modificación del campo de viento.

Avance v2.5: [biblioteca versionada y comprobación analítica](docs/parametros.md), con 73 parámetros del modelo base y 16 del entorno, procedencia exportable y preservada en archivos. Caso de presión y cargas con referencias fijas, errores y tolerancias. VAL-01/02/04/10 tienen avance parcial: siguen pendientes resistencias con fuente técnica, casos experimentales y validación física.

Entrega B2 implementada en v2.6: [editor de manzanas](docs/editor.md) sobre las parcelas existentes, con paleta de infraestructuras, colocación por arrastre o selección, propiedades por objeto, deshacer/rehacer y guardado reproducible. B3 está implementada en v2.7: [taller de simulación](docs/taller.md), con árboles y bancas independientes, recorridos dibujados, ejemplos y explicación de eventos. Calles y terrenos de forma libre se abordan en una entrega posterior. El desglose y sus criterios están en [el plan integrado del editor](docs/editor-didactico.md).

## 0. Base disponible — completada

- [x] **BASE-01** Catálogo vinculado a categorías del Censo 2024: albañilería, entramado de madera/acero y hormigón armado; fuentes y supuestos visibles.
- [x] **BASE-02** Catorce combinaciones de perfil y cubierta; pérdida de techo, revestimientos, uniones y soporte de paredes mediante un modelo simplificado.
- [x] **BASE-03** Casa individual y manzanas ilustrativas de 9 o 16 casas, perfiles uniformes o mixtos, separación configurable y orientaciones por fila.
- [x] **BASE-04** Mundo físico compartido, colisiones de fragmentos entre viviendas y tres trayectorias lineales del tornado a velocidad fija.
- [x] **BASE-05** Resultados por casa y agregados, identificación de viviendas, enfoque de cámara y colores de daño por lote.
- [x] **BASE-06** Comparación determinista de perfiles individuales con condiciones comunes, cancelación, pausa y reinicio.
- [x] **BASE-07** Interfaz adaptable, documentación, 88 pruebas automatizadas y compilación comprobadas; código en GitHub.

Límites actuales: trazados sintéticos; propiedades físicas ilustrativas; roturas por impacto opcionales con criterio educativo; viento sin apantallamiento ni canalización por edificios; sin presión interior ni validación experimental. El modo visual conserva vegetación decorativa; el modo físico incluye uniones rompibles de árboles y bancos.

## 1. Experimentos reproducibles y explicación del daño — P0

Entrega A implementada en v2.2. Depende de la base disponible. Consulta [uso, formato y límites del cuaderno](docs/experimentos.md).

- [x] **EXP-01** Definir un formato versionado de experimento con unidades, geometría, materiales, uniones, viento, trayectoria, duración y configuración del cálculo.
- [x] **EXP-02** Guardar, cargar, duplicar y nombrar experimentos; distinguir configuraciones iniciales de resultados ya calculados.
- [x] **EXP-03** Exportar e importar configuraciones JSON con validación y migración de versiones.
- [x] **EXP-04** Exportar resultados CSV por vivienda, componente y conjunto, conservando identificadores y unidades.
- [x] **EXP-05** Generar informes con parámetros, imágenes, métricas, fuentes, versión y limitaciones del modelo.
- [x] **EXP-06** Incorporar una línea de tiempo de eventos: qué unión falló, cuándo, por qué causa y qué piezas perdieron soporte después.
- [x] **EXP-07** Permitir seleccionar una casa o pieza y consultar su material, masa, carga, capacidad, conexiones y estado.
- [x] **EXP-08** Mostrar gráficos de daño acumulado y distinguir el estado actual de los máximos históricos.
- [x] **EXP-09** Reproducir una ejecución guardada, volver al inicio y navegar sus eventos sin confundir una repetición visual con un nuevo cálculo.
- [x] **EXP-10** Comparar manzanas con idéntico escenario inicial, variando una condición a la vez: refuerzo, distribución, separación, cubierta o recorrido.
- [x] **EXP-11** Compartir experimentos mediante archivos y evaluar enlaces reproducibles sin depender de la sesión local.
- [x] **EXP-12** Mostrar tiempo simulado, tiempo real transcurrido y ritmo de avance cuando el equipo no alcanza tiempo real.

Criterio de salida: otra persona puede cargar una configuración, repetirla con la misma versión y explicar el primer daño y sus consecuencias a partir del registro exportado.

## 2. Generación urbana 3D y editor de escenarios — P1

Depende del formato de experimento de la etapa 1. Primera entrega B1 disponible en v2.3: [generador de barrio y alcance](docs/barrio.md). El editor y las propiedades por objeto están disponibles desde [v2.6](docs/editor.md) sobre la cuadrícula actual; v2.7 añade árboles y bancas independientes; permanecen pendientes las calles de forma libre.

- [x] **URB-01** Generalizar las cuadrículas actuales a manzanas de tamaño y forma configurables, con calles perimetrales, interiores y orientación definidas.
- [x] **URB-02** Incorporar parcelas, veredas, accesos, patios, retranqueos y separación entre construcciones.
- [ ] **URB-03** Configurar densidad, ocupación de suelo, proporción de tipos de construcción y proporción de zonas verdes; identificar las distribuciones manuales o sintéticas.
- [x] **URB-04** Incorporar una semilla de generación para reconstruir exactamente el mismo barrio.
- [x] **URB-05** Evitar superposición entre volúmenes, parcelas, calles, zonas verdes y accesos mediante reglas geométricas explícitas.
- [x] **URB-06** Crear un editor con paleta para arrastrar, colocar, mover, rotar, duplicar y eliminar construcciones y zonas verdes, con ajuste a parcelas/cuadrícula y deshacer/rehacer. URB-12 añade árboles y bancas independientes en v2.7.
- [x] **URB-07** Permitir configurar cada parcela y objeto desde su selección: perfil y cubierta de casas, pisos de edificios y propiedades disponibles de áreas verdes, conservando identificadores y límites del catálogo físico.
- [x] **URB-08** Añadir escenarios predefinidos: residencial de baja altura, barrio mixto, entorno con edificios y barrio con parque; incluir un ejemplo guiado de viviendas reforzadas.
- [x] **URB-09** Permitir repetir comparaciones sobre la misma geometría, conservando identidades de edificios, parcelas y elementos del terreno.
- [ ] **URB-10** Diferenciar visualización, geometría de colisión y modelo resistente de cada objeto del catálogo.
- [ ] **URB-11** Ampliar el editor a calles, parcelas y terrenos de forma libre, con reglas de acceso, separación y geometría válidas; conservar la reconstrucción reproducible.
- [x] **URB-12** Extender la paleta a árboles y mobiliario colocados individualmente, con identidades, reglas de geometría y modelo físico propios.

Alcance de B1: cuadrículas rectangulares de 2 a 4 filas y columnas; parcelas, veredas y accesos simples; proporciones de usos, reservas para edificios y parques visuales. URB-03 tiene avance parcial: faltan proporciones por variante constructiva y control independiente de ocupación edificada.

Alcance de B2 disponible en v2.6: edición sobre la cuadrícula actual, vista previa de colocación válida/inválida, propiedades por objeto y alternativas al arrastre para teclado y pantalla táctil. El plano editado debe guardarse explícitamente: la semilla por sí sola no representa los cambios manuales. El esquema 5 conserva geometría y propiedades manuales, con migración de archivos anteriores. Un objeto rechazado no reemplaza ni elimina el anterior. Las reglas de URB-05 deben comprobar también los cambios manuales.

B3 añade planos `parcel-editor-2`, esquema 6, hasta 48 árboles/bancas independientes y cuatro ejemplos; recorridos de 2–24 puntos, avance de 0,5–8 m/s y duración de 5–180 s o sin límite. Las causas visibles proceden de eventos y la vista inicial es solo una referencia geométrica. FIS-08 mantiene pendientes ráfagas y perfil vertical; FIS-09 permite comparar un recorrido dibujado con las opciones lineales, pero no dos polilíneas arbitrarias desde el comparador. VER-02/04 y PRO-01/12 conservan ampliaciones de catálogo, capas y tutoriales.

Criterio de salida de B2 cumplido sobre la cuadrícula actual; la etapa completa incorpora las ampliaciones pendientes: un escenario mixto puede generarse, editarse, guardarse y regenerarse con posiciones y parámetros idénticos, sin solapamientos no intencionados.

## 3. Edificios y ampliación del catálogo construido — P1 / P2

La generación visual y la configuración son P1. La respuesta estructural requiere el trabajo y la validación de las etapas 5 y 6.

- [ ] **EDI-01** Incorporar edificios bajos y de altura intermedia al generador, con número de pisos, planta, altura de entrepiso y orientación configurables.
- [ ] **EDI-02** Ampliar posteriormente a edificios altos, con límites de representación y cálculo documentados.
- [ ] **EDI-03** Distinguir edificios residenciales, comerciales, galpones y equipamientos; definir qué tipologías tendrá cada primera entrega.
- [ ] **EDI-04** Parametrizar cubiertas, fachadas, ventanas, balcones, parapetos y equipos de techo como componentes identificables.
- [ ] **EDI-05** Definir el modelo resistente por tipología: muros, pórticos u otra idealización respaldada; evitar tratar un edificio como una casa simplemente escalada.
- [x] **EDI-06** Distinguir daño en envolvente, elementos secundarios, conexiones y estructura principal.
- [ ] **EDI-07** Incorporar resultados por edificio y, cuando el modelo lo permita, por piso o fachada.
- [x] **EDI-08** Incluir edificios y viviendas en un mismo mundo físico y evaluar colisiones de sus fragmentos con el entorno.
- [ ] **EDI-09** Incorporar casas de adobe y viviendas de emergencia con geometría, uniones y comportamiento propios.
- [ ] **EDI-10** Ampliar variaciones de planta, altura, pendiente y geometría de cubierta de las viviendas, registrando las fuentes de cada variante.
- [ ] **EDI-11** Definir cuándo se modelan piso, base, anclajes y fundación y cuándo permanecen idealizados.

Criterio de salida: un barrio puede combinar casas y edificios, diferenciando qué elementos son decorativos, cuáles colisionan y cuáles participan en el cálculo de daño.

## 4. Zonas verdes y vegetación — P1 / P2

Primero se incorporan a la generación y edición 3D; después, por separado, sus colisiones, daño y posible efecto sobre el viento.

- [ ] **VER-01** Generar plazas, parques, áreas de césped, jardines, patios y franjas verdes entre parcelas y calles.
- [ ] **VER-02** Configurar superficie, ubicación, distribución y densidad de árboles, arbustos y setos, respetando accesos y huellas de edificios.
- [ ] **VER-03** Definir árboles por clases de tamaño y geometría: altura, tronco y copa; asignar identificadores a los elementos físicos.
- [ ] **VER-04** Incorporar reglas de distribución reproducibles y edición manual de zonas y vegetación.
- [x] **VER-05** Distinguir vegetación visual, obstáculos con colisión y vegetación con daño físico; permitir elegir el nivel de detalle.
- [ ] **VER-06** Modelar de forma simplificada rotura de ramas, caída de árboles y fallo de anclaje, con parámetros y fuentes documentados.
- [ ] **VER-07** Permitir colisiones de árboles y ramas con edificios, otras plantas e infraestructura, e integrar sus eventos y daños.
- [ ] **VER-08** Investigar y validar el arrastre, la porosidad y la influencia de copas y setos sobre el campo de viento.
- [ ] **VER-09** Comparar escenarios con y sin vegetación; evaluar simultáneamente posibles cambios del viento y riesgos por caída o fragmentos, sin asumir protección automática.
- [ ] **VER-10** Incluir superficie verde, vegetación dañada y efectos sobre construcciones en los resultados del conjunto.

Criterio de salida inicial: las zonas verdes forman parte del escenario guardado y se puede identificar su función visual o física. Su efecto aerodinámico solo se habilita con un modelo explícito y una verificación correspondiente.

## 5. Viento, uniones e interacción de daños — P1 / P2

Depende de eventos y trazabilidad de la etapa 1. Se desarrolla por mecanismos independientes y comprobables.

- [x] **FIS-01** Incorporar daño por impacto de fragmentos con un criterio explícito de demanda y capacidad, registrando origen, receptor y causa.
- [x] **FIS-02** Representar cadenas de daño entre construcciones y vegetación y comprobar que cada evento adicional tenga una causa física registrada.
- [x] **FIS-03 (primer alcance)** Aplicar arrastre y giro según geometría, masa y orientación. Comparar plancha y panel bajo el mismo viento. La calibración por material y la fragmentación física quedan pendientes.
- [x] **FIS-04 (primer alcance)** Barrer fragmentos rápidos contra piezas fijas y verificar cruces, pasos laterales y reproducibilidad. Quedan pendientes la rotación continua y los cruces entre cuerpos móviles.
- [ ] **FIS-05** Incorporar presión interior, aberturas y cambios de carga posteriores a rotura de ventanas, puertas o cubierta.
- [ ] **FIS-06** Mejorar la transferencia y redistribución de cargas entre cubierta, paredes, estructura, anclajes y base.
- [ ] **FIS-07** Evaluar conexiones elásticas y modos de falla específicos, ampliando gradualmente la idealización rígida actual.
- [ ] **FIS-08** Parametrizar velocidad de traslación, duración, anchura, intensidad variable, ráfagas y perfil vertical del viento.
- [ ] **FIS-09** Permitir dibujar y guardar trayectorias personalizadas y comparar recorridos sobre el mismo entorno.
- [ ] **FIS-10** Incorporar visualización cuantitativa del viento: vectores, magnitudes, mapas y puntos de consulta, diferenciada del vórtice decorativo.
- [ ] **FIS-11** Definir estados de daño por tipología y distinguir pérdida de envolvente, pérdida de soporte y colapso sin depender únicamente de porcentajes de piezas.
- [ ] **FIS-12** Definir y, cuando existan datos y un modelo comprobable, incorporar respuesta de suelo y fundaciones; distinguir deformación del terreno, fallo de anclaje y contacto con el plano estático.

Criterio de salida por mecanismo: existe una prueba aislada, un evento explicable, una definición de sus parámetros y una comprobación de sus efectos sobre resultados y estabilidad numérica.

## 6. Respaldo técnico, validación e incertidumbre — P0 transversal / P2

La identificación de fuentes y las pruebas empiezan desde la primera etapa. Las capacidades avanzadas se habilitan conforme exista evidencia suficiente.

- [ ] **VAL-01** Crear una biblioteca versionada de propiedades y resistencias, indicando fuente técnica, tipología, unidades, intervalo de aplicación y nivel de evidencia.
- [ ] **VAL-02** Seleccionar un caso de referencia pequeño con geometría y cargas conocidas y contrastar los resultados del simulador.
- [ ] **VAL-03** Incorporar casos de ensayo, túnel de viento o daño observado cuando los datos permitan una comparación apropiada.
- [ ] **VAL-04** Definir métricas de error y criterios de aceptación; separar verificación del programa y validación física.
- [ ] **VAL-05** Realizar estudios de sensibilidad a resistencia, masa, anclajes, geometría y viento.
- [ ] **VAL-06** Introducir distribuciones de parámetros respaldadas y muestreo reproducible de escenarios.
- [ ] **VAL-07** Ejecutar conjuntos de simulaciones y mostrar probabilidades de estados de daño, dispersión y percentiles, con número de muestras y supuestos visibles.
- [ ] **VAL-08** Estudiar estabilidad de resultados frente al paso temporal, discretización de piezas y aproximaciones de colisión.
- [ ] **VAL-09** Investigar funciones de fragilidad por tipología e intensidad, diferenciando las estimadas con datos de las generadas por un modelo educativo.
- [ ] **VAL-10** Mantener visible el nivel de respaldo de cada módulo y evitar presentar resultados no validados como predicciones de una construcción real.

Estado v2.5: biblioteca `parameters-1` y caso `pressure-reference-1` disponibles. Las casillas de esta etapa permanecen pendientes porque su alcance completo incluye datos técnicos y validación que esta comprobación analítica no sustituye.

Criterio de salida: todo resultado técnico puede vincularse a su versión, fuentes, hipótesis, evaluación de error e incertidumbres pendientes.

## 7. Geometría e inventarios territoriales reales — P2

Depende del generador, del formato de experimento y de controles de calidad de datos.

- [ ] **GEO-01** Incorporar selección por región o comuna y consultar tabulados o microdatos censales disponibles, conservando universo, faltantes y fecha.
- [ ] **GEO-02** Importar huellas de edificios, parcelas, calles y zonas verdes en formatos geográficos; evaluar GeoJSON y otras fuentes compatibles.
- [ ] **GEO-03** Definir coordenadas, proyección, unidades y conversión al sistema local de la simulación.
- [ ] **GEO-04** Incorporar alturas, pisos, tipologías y materialidades cuando existan datos; identificar atributos inferidos o asignados.
- [ ] **GEO-05** Separar proporciones estadísticas agregadas de atributos observados por edificio; no asignar a una vivienda una característica censal no disponible individualmente.
- [ ] **GEO-06** Incorporar parques, arbolado y otras superficies verdes desde inventarios territoriales disponibles.
- [ ] **GEO-07** Incorporar terreno y relieve cuando sean relevantes para la geometría y el modelo de viento seleccionado.
- [ ] **GEO-08** Evaluar importación de modelos CAD/BIM o mallas urbanas y simplificarlos sin confundir detalle visual con información resistente.
- [ ] **GEO-09** Comprobar cobertura, geometrías inválidas, duplicados, licencias, procedencia y atributos faltantes de cada fuente.

Criterio de salida: se puede reconstruir una zona real y distinguir, objeto por objeto, datos observados, inferencias y supuestos del escenario.

## 8. Viento modificado por el entorno y conexión con CFD — P2 / P3

Depende de geometría de calidad y de casos de validación. No presupone que un cálculo CFD completo deba ejecutarse en tiempo real en el navegador.

- [ ] **CFD-01** Definir interfaces para cargar campos de viento y presiones externas calculados por otro modelo.
- [ ] **CFD-02** Evaluar exportación de geometría e importación de resultados de herramientas especializadas.
- [ ] **CFD-03** Representar apantallamiento, aceleración entre edificios, estelas y variación con la altura mediante un enfoque documentado.
- [ ] **CFD-04** Integrar la vegetación como obstáculo o medio poroso solo cuando el modelo y sus parámetros lo respalden.
- [ ] **CFD-05** Evaluar varias direcciones y condiciones meteorológicas, con ponderaciones cuando existan datos aplicables.
- [ ] **CFD-06** Mapear presiones y momentos a fachadas, cubiertas y componentes estructurales.
- [ ] **CFD-07** Visualizar mapas, líneas de corriente y puntos de consulta con unidades, leyenda y procedencia del cálculo.
- [ ] **CFD-08** Validar el acoplamiento y estudiar el tratamiento de cambios geométricos después del daño; distinguir campos precalculados de campos que se actualizan.

Criterio de salida: el efecto del entorno sobre el viento tiene un caso de comprobación y una procedencia explícita; las aproximaciones y el costo de cálculo son visibles.

## 9. Consecuencias, mitigación y decisiones — P3

Depende de estados de daño respaldados y datos de costos o exposición. No se convierte automáticamente una fracción de piezas perdidas en una pérdida económica.

- [ ] **CON-01** Estimar reparación y reconstrucción por componente y edificio usando modelos de consecuencia y costos con fuente, lugar y fecha.
- [ ] **CON-02** Estimar cantidad y tipo de escombros y necesidades de retiro, con supuestos explícitos.
- [ ] **CON-03** Evaluar pérdida de uso, interrupción de actividades y tiempos de recuperación cuando existan modelos aplicables.
- [ ] **CON-04** Incorporar exposición y necesidades agregadas de alojamiento o desplazamiento, con datos adecuados al alcance del estudio.
- [ ] **CON-05** Comparar medidas de mitigación: refuerzo de uniones, protección de aberturas, cambios de cubierta y distribución urbana o vegetal.
- [ ] **CON-06** Evaluar alternativas con un presupuesto y objetivos definidos, incluyendo incertidumbre de costos y beneficios.
- [ ] **CON-07** Generar informes comparativos que separen daño físico, pérdidas económicas y consecuencias sociales.

Criterio de salida: cada estimación de consecuencias conserva sus datos, modelo, supuestos e incertidumbre, además del experimento físico de origen.

## 10. Rendimiento, experiencia de uso y distribución — transversal

- [ ] **PRO-01** Ampliar la selección e inspección por clic/toque en el escenario y las capas de cubierta, paredes, estructura, vegetación, viento y daño.
- [ ] **PRO-02** Incorporar vista general, seguimiento del tornado y enfoque por edificio, parcela o zona verde.
- [ ] **PRO-03** Evaluar instancias, niveles de detalle y reutilización de recursos para escenas urbanas más grandes.
- [ ] **PRO-04** Optimizar cuerpos activos y colisiones conservando las interacciones necesarias, incluidos fragmentos que alcanzan objetos fuera del radio del viento.
- [ ] **PRO-05** Separar calidad gráfica y precisión física; mostrar cuándo una configuración reduce el detalle del cálculo.
- [ ] **PRO-06** Ejecutar trabajos pesados y lotes de experimentos en segundo plano, con progreso, cancelación y límites configurables.
- [ ] **PRO-07** Establecer escenarios de rendimiento de referencia para escritorio y móvil y límites documentados de tamaño de escena.
- [ ] **PRO-08** Mantener navegación por teclado, controles legibles, tablas accesibles y gráficos con unidades y leyendas; permitir colocar por selección y destino sin arrastrar, con alternativa táctil y avisos de colocación que no dependan solo del color.
- [ ] **PRO-09** Ampliar pruebas de regresión a escenarios urbanos, importación/exportación, edificios, vegetación y mecanismos nuevos.
- [ ] **PRO-10** Mantener compilación, pruebas y comprobaciones de recursos en GitHub Actions.
- [ ] **PRO-11** Preparar publicación web de versiones estables, ejemplos descargables y documentación para usuarios.
- [ ] **PRO-12** Incorporar tutoriales y experimentos guiados que expliquen causas, resultados y límites de cada módulo.

## 11. Experiencia didáctica — P1

Estos ítems coordinan capacidades ya identificadas en URB, EXP, FIS y PRO; sus referencias no representan implementaciones duplicadas.

- [ ] **UX-01** Organizar el recorrido en Construir → Simular → Entender, con acciones principales y estado de cada paso visibles; permitir volver al diseño de forma explícita.
- [ ] **UX-02** Dar protagonismo al terreno, con paleta de objetos y panel de propiedades de la selección; mostrar controles avanzados bajo demanda y mantener accesibles fuentes, supuestos y alcance físico.
- [x] **UX-03** Ofrecer ayudas breves según la acción, una guía inicial y ejemplos listos para modificar, reutilizando URB-08 y PRO-12.
- [x] **UX-04** Explicar daños al seleccionar una pieza o recorrer la línea de tiempo, a partir de los eventos registrados de EXP-06/07/09; distinguir causas calculadas, datos ausentes y límites del modelo.
- [x] **UX-05** Facilitar la lectura visual del estado inicial y dañado y de las alternativas comparadas, reutilizando EXP-09/10 y URB-09; conservar geometría e identidades cuando solo se modifica el refuerzo.
- [x] **UX-06** Diferenciar edición, cálculo y repetición. Bloquear transformaciones mientras corre la física o se reproduce una grabación; volver al diseño requiere una reconstrucción intacta explícita y conservar o descartar resultados mediante acciones claras.

Criterio de salida inicial: una persona puede colocar una casa, un edificio y un parque con arrastre o selección, corregir una acción con deshacer, guardar el barrio, ejecutar un recorrido y consultar una explicación de daño sin abrir parámetros avanzados. El mismo barrio editado se recupera con idéntica geometría y propiedades.

## Orden integrado de las próximas entregas

Punto de partida: A y B1/B2/B3 disponibles; C y D tienen avances parciales en v2.4/v2.5. B2 se cerró en v2.6 para casas, edificios y parques como conjunto; el detalle figura en [el editor](docs/editor.md). Se conservan todas las tareas pendientes anteriores y se reorganizan las próximas entregas:

| Orden | Entrega | Alcance principal | Condición para cerrar |
| --- | --- | --- | --- |
| Completada en v2.6 | B2 · Construir | Editor por parcelas, arrastre/selección, propiedades, deshacer/rehacer, guardado; URB-06/07, UX-01/02/06, PRO-01/08 | Barrio mixto editable, sin solapamientos indebidos, guardable y reproducible; compatibilidad histórica |
| Completada en v2.7 | B3 · Simular y entender | Objetos verdes independientes, ejemplos guiados, trayectorias dibujadas, controles de duración/intensidad y explicación visual; URB-08/09/12, VER-02/04, FIS-08/09, UX-03/04/05 | Recorrido guardable, eventos explicables y comparación con la misma geometría editada |
| En curso | C · Interacción física | Roturas por impacto en v2.8 (FIS-01/02), barrido contra piezas fijas en v2.9 (FIS-04) y vuelo orientado en v2.10 (FIS-03). Pendientes la calibración y la ampliación de árboles, mobiliario y edificios. | Pruebas por mecanismo, origen/receptor de impactos y límites físicos documentados |
| Transversal desde B2 | D · Respaldo y validación | Fuentes por propiedad, calibración, caso físico de referencia, error, sensibilidad y estabilidad; VAL-01 a VAL-05/08/10 | Evidencia y criterios específicos para cada capacidad que se incorpore |
| 4 | B4 / E · Escala y territorio | Calles y terrenos libres, catálogo ampliado, rendimiento, datos por región/comuna e importación geográfica; URB-03/11, EDI, VER, GEO y PRO | Geometría válida, procedencia y distinción entre datos observados y supuestos |
| 5 | E / F · Análisis avanzado | Incertidumbre y fragilidad, viento urbano/CFD, suelo/fundaciones y consecuencias; VAL-06/07/09, CFD, FIS-12, EDI-11, GEO-07 y CON | Datos suficientes, modelos propios y validación de cada acoplamiento; daño de suelo con alcance explícito |

Las tareas transversales de validación, rendimiento y accesibilidad acompañan a todas las entregas. Incorporar edificios o árboles a una imagen no implica haber incorporado su respuesta estructural ni su efecto sobre el viento.

## Referencias para comparar capacidades

Estas referencias orientan objetivos y mecanismos; no implican que sus modelos puedan trasladarse directamente a SimTorCL ni que todas aborden tornados.

- [SimScale: análisis de viento urbano y resultados de flujo](https://www.simscale.com/docs/analysis-types/pedestrian-wind-comfort-analysis/).
- [NHERI SimCenter WE-UQ: ingeniería de viento e incertidumbre](https://github.com/NHERI-SimCenter/WE-UQ).
- [NHERI SimCenter R2D: riesgo e inventarios regionales](https://simcenter.designsafe-ci.org/research-tools/r2dtool/).
- [ETDA: investigación sobre daño por tornado, presiones, capacidades y validación](https://www.frontiersin.org/journals/built-environment/articles/10.3389/fbuil.2020.00089/full).
- [Hazus: descripción institucional de análisis de daños y pérdidas](https://coast.noaa.gov/digitalcoast/tools/hazus-mh.html).
- [INE: resultados del Censo 2024](https://censo2024.ine.gob.cl/resultados/).

El detalle de las entregas previas permanece en [TODO.md](TODO.md); el modelo actual y sus límites se describen en [docs/modelo.md](docs/modelo.md).
