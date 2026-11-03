# Biblioteca de parámetros y comprobación analítica (v2.5)

Esta entrega avanza VAL-01, VAL-02, VAL-04 y VAL-10. Completa la primera biblioteca de procedencia y una comprobación del cálculo; la calibración de capacidades y la validación física permanecen pendientes.

## Consultar y exportar

Abre **Parámetros y fuentes**. La tabla inicial mantiene los valores del perfil seleccionado. En **Explorar parámetros y procedencia** se puede filtrar por grupo y buscar por propiedad o identificador.

La biblioteca `parameters-1` registra 73 parámetros declarados del modelo de viviendas, reglas de daño, motor, viento y trayectoria. Un barrio con entorno físico añade los 16 parámetros declarados de árboles, bancos y edificios, para un total de 89. Contiene el catálogo de perfiles completo, no solo las propiedades activas de una vivienda. No incluye todas las constantes internas del programa ni todos los atributos de cada pieza: esos valores se consultan en la inspección y el inventario urbano guardado.

Cada entrada registra identificador estable, valor, unidad, grupo, ámbito de aplicación, origen, nivel de evidencia, referencias numéricas, sección, estado e intervalo calibrado. Actualmente las referencias numéricas están vacías y el intervalo es `null`: no se ha extraído una resistencia de una fuente técnica. Paso temporal e iteraciones se identifican como configuración numérica; los restantes valores son supuestos educativos. Los valores adimensionales usan unidad `1`.

Las categorías del Censo, los índices de manuales y las ecuaciones aerodinámicas se registran por separado. Una referencia de clasificación no respalda una capacidad mecánica. Las referencias localizadas sin extracción conservan ese estado; no se les asignan páginas o fechas de lectura no comprobadas. La altura nominal del árbol no controla por sí sola la geometría de la copa y la masa nominal del núcleo de hormigón no implica que sea deformable: ambas limitaciones se explicitan.

Los botones descargan la biblioteca completa en JSON y los parámetros en CSV. Las nuevas configuraciones y ejecuciones guardan una copia de la biblioteca; el informe HTML incluye sus valores y metadatos. Los filtros de pantalla no recortan la exportación.

## Caso de referencia `pressure-reference-1`

**Ejecutar comprobación** no avanza ni modifica el experimento. Compara magnitudes calculadas con referencias analíticas fijas e informa error absoluto y criterio por fila:

| Magnitud                        | Condición                                         | Referencia                                                                     |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Presión dinámica                | V = 36 km/h = 10 m/s, ρ = 1,225 kg/m³             | 61,25 Pa                                                                       |
| Arrastre                        | q anterior, Cd = 0,7, A = 2 m²                    | 85,75 N                                                                        |
| Componentes del campo sintético | posición (0, 0, 4) m, centro (0, 0, 0), radio 8 m | Fx = −46,92135220967635 N; Fy = 38,64111358443935 N; Fz = −9,936286350284405 N |
| Velocidad doble                 | V = 72 km/h, misma posición, área y radio         | Cuatro veces cada componente anterior                                          |
| Viento cero                     | V = 0 km/h                                        | Fuerza nula                                                                    |
| Límite del campo                | Distancia = radio = 8 m                           | Fuerza nula                                                                    |

La referencia del campo aplica una atenuación `0,5^1,15`, factores tangencial 0,85, radial 0,18 y vertical 0,7. Estos factores son educativos de SimTorCL. La función de presión dinámica comprobada es la misma que utiliza `windAt` para viviendas y entorno. La prueba cubre 10 magnitudes, con `error absoluto ≤ 1e-9 * max(1, abs(referencia))`, en la unidad de cada magnitud. La tolerancia admite redondeo de coma flotante y no representa un error físico aceptable del modelo.

Las ecuaciones `q = ρV²/2` y `D = Cd·q·A` se consultaron el 3 de noviembre de 2026 en [NASA: Dynamic Pressure](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/dynamic-pressure/) y [NASA: Drag Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/), secciones Derivation, Drag Coefficient y Reference Area. Estas fuentes respaldan las ecuaciones; no aportan el Cd = 0,7 ni validan la densidad asumida para un escenario chileno, el campo de tornado o las capacidades constructivas.

El resultado puede descargarse como JSON con entradas, referencias, errores, tolerancias y fuentes. Es una **verificación analítica del programa**, no una validación experimental de desprendimientos, impactos, estructuras ni tornados reales. Faltan casos físicos con geometría, condiciones de ensayo y datos independientes.

## Compatibilidad y siguientes pasos

El esquema de archivo pasa a 4 e incorpora `parameterLibrary`. Se conservan `pressure-v2.1`, su identificador `simtorcl-33082313` y `urban-environment-1`, porque los valores y el comportamiento de esos modelos no cambian. Las versiones 1–3 migran a esquema 4 con `parameterLibrary: null`: no se añade evidencia retrospectivamente. Los esquemas 1/2 conservan el entorno visual anterior y el 3 conserva el entorno físico declarado. El informe identifica la ausencia de biblioteca histórica y conserva la versión de aplicación de origen.

La importación contrasta la biblioteca presente con el descriptor compatible, incluida su procedencia; rechaza alteraciones de valores, unidades y fuentes. Esto no es una firma de autenticidad ni certifica resultados importados. La prueba con una ejecución física v2.4 dañada conserva eventos y fotogramas y reproduce exactamente sus resultados.

Antes de sustituir un supuesto mecánico: seleccionar una tipología concreta, revisar una fuente completa y su sección/página, registrar condiciones, unidades y rango de aplicación, definir la conversión al modelo y contrastar un caso independiente. Todo cambio numérico o de algoritmo debe versionar el modelo correspondiente. Continúan pendientes la calibración técnica, sensibilidad, validación estructural, impacto con nuevas roturas y viento modificado por obstáculos.
