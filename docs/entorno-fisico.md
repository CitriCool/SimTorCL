# Entorno físico urbano (v2.4)

En **Barrio configurable → Configurar barrio**, el modo físico incorpora árboles, bancos y edificios al mismo mundo de colisiones de las viviendas. El modo visual conserva el comportamiento de v2.3. Los experimentos antiguos cargan en modo visual para no cambiar sus resultados históricos.

La prueba del formulario genera 2 × 2 parcelas con semilla 38, un parque sobre el recorrido y un edificio, viento de 280 km/h, radio de 12 m y refuerzo del 100 %. Comienza una ejecución nueva y permite observar el paso del tornado. Los controles habituales permiten reducir el viento o aumentar el refuerzo. Atravesar una parcela no implica destruir todos sus objetos: el campo debe alcanzar cada pieza y superar la capacidad de su unión durante 0,12 s.

## Comportamiento disponible

- Cada parque tiene dos árboles y dos bancos identificados por parcela. Los árboles separan tronco, dos ramas y dos partes de copa. Cada parque incluye dos condiciones de anclaje educativas (4 000 y 1 200 N·m), para distinguir desprendimiento de ramas y fallo de base; no representan especies observadas ni frecuencias reales. Los bancos separan bastidor, asiento y respaldo.
- El anclaje de árbol y las uniones de rama responden a momentos de viento; sus capacidades y demandas se registran en N·m. Las uniones de copa y mobiliario se registran en N. Las cargas proceden del campo ilustrativo ya utilizado por las viviendas.
- Al perder soporte, una pieza pasa de fijación ideal a cuerpo dinámico con masa, gravedad y arrastre. Los enlaces aún intactos entre piezas liberadas se conservan como restricciones rígidas. Se distinguen caída por fallo del anclaje y desprendimiento de ramas/copas.
- Cada parcela de edificio contiene un edificio residencial ilustrativo de 2 a 5 pisos, con altura de piso de 3 m. Su núcleo resistente es una caja fija que representa de forma gruesa estructura y losas. No es un modelo de colapso estructural, pórticos ni elementos finitos.
- Fachadas, ventanas y cubierta del edificio tienen piezas y fijaciones independientes. Pueden liberarse por sobrecarga o por pérdida del soporte que las une al núcleo.
- Las piezas liberadas pueden colisionar con viviendas, edificios, vegetación, mobiliario y suelo. Las colisiones producen contacto y movimiento. Con [Roturas por impacto](experimentos.md#roturas-por-impacto-v28-y-esquema-7) activadas, un golpe puede romper uniones del receptor. El suelo sigue siendo un plano fijo; el campo de viento no incluye apantallamiento, canalización ni interacción con copas.

La representación visual de cilindros y copas usa colisionadores de caja. Las fachadas son paneles completos y los vanos son esquemáticos. Las capacidades no dependen de especie, edad, enfermedad, humedad, diseño de anclaje o armaduras reales. Estas limitaciones impiden usar la simulación para evaluar un árbol o edificio concreto.

## Fuentes y evidencia

El panel **Daño del entorno urbano → Fuentes y parámetros del modelo** identifica institución, enlace, sección y estado de revisión. El Censo se utiliza para categorías de vivienda/materialidad; el índice oficial de manuales del MINVU y la referencia forestal de INFOR/CONAF orientan el trabajo documental de parques, arbolado y construcción.

**Ninguna masa, dimensión o capacidad nueva se presenta como un valor extraído de esos documentos oficiales.** Los parámetros de `ENV_MODEL` son una calibración educativa explícita. Cada propiedad mecánica registra unidad, nivel `illustrative`, lista vacía de fuentes numéricas y estado de calibración pendiente. Las referencias tipológicas y los valores mecánicos se almacenan por separado.

El inventario de cada ejecución registra dimensiones, masa, superficie efectiva de viento, posición inicial, orientación, soporte, capacidad y unidad de cada pieza. Las masas de madera del tronco y ramas se calculan como volumen cilíndrico por densidad educativa. Las copas, bancos y paneles usan masas o masas superficiales educativas. La superficie efectiva de viento puede diferir de la envolvente de colisión. La mera cita de una norma o manual no acredita su aplicación ni valida el modelo frente a tornados.

Fuentes registradas:

- [INE: Glosario de viviendas, Censo 2024](https://censo2024.ine.gob.cl/wp-content/uploads/2025/05/Glosario_viviendas_y_servicios-basicos_CPV2024.pdf).
- [MINVU · DITEC: Manuales técnicos](https://www.minvu.gob.cl/ditec/manuales-tecnicos-ditec/), índice consultado; extracción de propiedades pendiente.
- [INFOR: Técnicas de Planificación y Manejo del Arbolado Urbano](https://bibliotecadigital.infor.cl/bitstream/handle/20.500.12220/13191/13191.pdf?sequence=1), referencia localizada de evaluación del riesgo; no se han extraído capacidades por especie.

## Registro y compatibilidad

Los resultados de viviendas permanecen separados del entorno urbano. El panel nuevo cuenta piezas liberadas, uniones falladas, anclajes de árboles fallados y estado por objeto. Identificadores: `V-Pxx-Tn` para árboles, `M-Pxx-Bn` para bancos y `E-Pxx` para edificios.

El cuaderno permite inspeccionar estos componentes desde **ENV**, consultar eventos, enfocar piezas, recorrer fotogramas y recalcular. El CSV de objetos urbanos contiene resultados por entidad. El CSV de piezas incluye entidad y parcela; el de eventos distingue N y N·m. Los informes incluyen los resultados, el alcance y la procedencia del entorno.

El esquema 3 incorpora `environmentModel` y `environmentInventory`, además de los parámetros `environment` y `buildingFloors`. La importación compara modelo e inventario regenerado antes de reconstruir, valida las unidades y relaciones de eventos urbanos y rechaza geometrías o propiedades modificadas. El inventario no constituye una firma de autenticidad: los resultados importados siguen siendo declaraciones que pueden contrastarse con el recálculo.

Los esquemas 1 y 2 se migran con `environment: "visual"`; las viviendas y la geometría de parcelas conservan sus condiciones anteriores. Las nuevas ejecuciones físicas requieren comenzar desde una configuración física. Los fotogramas incluyen las piezas urbanas, pero no permiten continuar la física desde un fotograma.

La versión `urban-environment-1` debe cambiar cuando se altere su algoritmo o calibración. Toda evolución de propiedades numéricas necesita conservar la procedencia y las condiciones de aplicación. Siguen pendientes la calibración con datos técnicos, los modelos de colapso de edificios, la detección de impactos rápidos, la deformación del suelo y el acoplamiento aerodinámico.

Desde v2.5, el esquema 4 añade la [biblioteca de procedencia](parametros.md), sin modificar `urban-environment-1`. Los archivos de esquema 3 conservan su entorno físico y migran sin añadir una biblioteca histórica inexistente.
