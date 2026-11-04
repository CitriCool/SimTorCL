# Procedencia y calibración de SimTorCL 2

Fecha de revisión de fuentes: 2 de noviembre de 2026. Los valores físicos de esta versión son una calibración educativa, sin validación experimental ni resistencias certificadas.

## Información censal

Se consultaron el [glosario de características de las viviendas](https://censo2024.ine.gob.cl/wp-content/uploads/2025/05/Glosario_viviendas_y_servicios-basicos_CPV2024.pdf) y el [manual censal del INE](https://censo2024.ine.gob.cl/wp-content/uploads/2025/03/Manual_Censal_CPV2024.pdf). `src/catalog.js` conserva las URL, las fechas y las categorías utilizadas. Sus identificadores son internos de SimTorCL, no códigos oficiales de variables.

El tipo de vivienda y la materialidad son variables distintas. El catálogo activo representa una casa individual con acceso directo, no departamentos ni una muestra estadística del parque habitacional. Conserva como referencia las categorías de paredes, cubierta y piso, aunque el piso no sea seleccionable ni se modele su rotura.

| Perfil              | Categoría de paredes exteriores utilizada |
| ------------------- | ----------------------------------------- |
| Albañilería         | Albañilería                               |
| Entramado de madera | Tabique forrado por ambas caras           |
| Entramado de acero  | Tabique forrado por ambas caras           |
| Hormigón armado     | Hormigón armado                           |

Las variantes de madera y acero son decisiones del modelo dentro de una misma alternativa censal. Las cuatro cubiertas se vinculan a planchas metálicas, planchas de fibrocemento, tejas/tejuelas y losa de hormigón. El resto de categorías se conserva en el catálogo de referencia para futuras ampliaciones.

No se incorporan porcentajes de prevalencia. Las categorías describen viviendas particulares; los resultados publicados sobre materialidad deben interpretarse con el universo y los faltantes de cada tabulado, habitualmente viviendas particulares ocupadas con moradores presentes. No se extrapolan porcentajes agregados de viviendas a casas exclusivamente ni se multiplican porcentajes marginales para inventar combinaciones. Incorporar distribución territorial o combinaciones más frecuentes requiere consultar [tabulados o microdatos del INE](https://censo2024.ine.gob.cl/resultados/), registrar su universo y distinguir valores faltantes.

La materialidad censal y su clasificación de calidad no determinan resistencia estructural frente al viento. El censo no aporta las masas, conexiones, umbrales de rotura ni coeficientes que necesita esta demostración.

## Supuestos geométricos y de masa

Todas las casas tienen planta de 6,4 × 6,4 m, paredes de 3 m y tres segmentos por fachada. Las cubiertas inclinadas tienen pendiente de 0,34 rad y aleros de 0,45 m. Las dimensiones y discretizaciones son comunes o explícitas para facilitar comparaciones; no proceden de planos censales.

| Perfil      | Espesor de pared (m) | Masa superficial estructural (kg/m²) | Capacidad base de uniones (N/m²) | Capacidad de secundarios (N/m²) | Masa de secundarios (kg/m²) |
| ----------- | -------------------: | -----------------------------------: | -------------------------------: | ------------------------------: | --------------------------: |
| Albañilería |                 0,18 |                                  260 |                             1600 |                       No aplica |                   No aplica |
| Madera      |                 0,14 |                                   32 |                              850 |                             300 |                           9 |
| Acero       |                 0,12 |                                   28 |                             1250 |                             420 |                          11 |
| Hormigón    |                 0,16 |                                  360 |                             4000 |                             650 |                          22 |

| Cubierta           |     Piezas | Masa superficial (kg/m²) | Espesor del colisionador (m) | Capacidad base de fijación (N/m²) |
| ------------------ | ---------: | -----------------------: | ---------------------------: | --------------------------------: |
| Planchas metálicas |         16 |                      4,2 |                        0,065 |                               250 |
| Fibrocemento       |         16 |                       12 |                         0,07 |                               300 |
| Tejas/tejuelas     | 64 módulos |                       40 |                         0,09 |                               190 |
| Losa de hormigón   |          1 |                      300 |                         0,15 |                             10000 |

La masa de cada pieza es su superficie multiplicada por la masa superficial asumida. Los espesores de colisión de cubiertas finas son mayores que un espesor de chapa real para mejorar la estabilidad numérica. Cada módulo de tejas representa un conjunto, no una teja individual. Madera y acero incluyen revestimientos independientes en las cuatro fachadas. Hormigón incluye módulos de ventanas secundarios y una puerta decorativa. La masa estructural y la secundaria se contabilizan por separado.

Todos estos números se eligieron para explorar diferencias dentro de la demostración. No se presentan como propiedades medidas ni como reglas universales que ordenen la seguridad de los materiales. Sustituirlos por valores respaldados técnicamente requerirá documentar geometrías, estado de conservación, anclajes y evidencia de validación.

## Viento y uniones

El centro del tornado recorre la misma órbita determinista en todos los escenarios: `x = 5.5 cos(0.17 t + 0.6)`, `z = 4.4 sin(0.17 t + 0.6)`. La velocidad ingresada se expresa en km/h; la geometría usa metros. La intensidad aumenta durante los primeros 1,8 s.

La presión de referencia es `q = 0.5 × 1.225 × (v/3.6)²`. Se atenúa radialmente mediante `(1-r/R)^1.15` y verticalmente hasta extinguirse a 32 m. El campo tiene componentes tangencial (0,85), radial hacia el centro (0,18) y ascendente (0,7). Son coeficientes ilustrativos, sin resolución de dinámica de fluidos.

Las paredes reciben la proyección normal de la carga horizontal más un término de cizalle de 0,12; su componente vertical se multiplica por 0,12. La presión actúa sobre la superficie de cada pieza. Esta regla es común a los perfiles; se eliminó el factor global 0,16 que protegía todas las paredes en la primera versión. Para cubierta, el peso propio reduce la demanda de succión sobre las fijaciones. Los fragmentos liberados reciben además arrastre cuadrático opuesto a su velocidad.

Una conexión de base tiene capacidad `superficie × capacidad base del perfil × refuerzo/100`. Las uniones entre segmentos usan un factor 0,7 y las de esquina 0,9; su demanda es 0,75 de la mayor carga de sus extremos. Las cubiertas inclinadas tienen dos fijaciones predefinidas por pieza, repartiendo capacidad y demanda entre ellas. La losa tiene cuatro apoyos, uno por fachada. La carga usada para rotura es un indicador por pieza, no la reacción calculada de una unión elástica.

La demanda debe superar la capacidad durante 0,12 s para romper una unión. Si cesa la sobrecarga, el tiempo acumulado se reduce al doble de velocidad. El refuerzo editable, de 50 a 200 %, multiplica las capacidades de base, paredes, cubierta y elementos secundarios; no reconstruye piezas ya rotas.

Los elementos fijados son cuerpos estáticos unidos mediante un grafo ideal. Un segmento de pared se libera cuando pierde todo camino a la base a través de uniones de pared o esquina intactas. Las uniones que sobreviven entre segmentos liberados se convierten en restricciones rígidas Cannon-es para conservar el conjunto hasta que también fallen. Los revestimientos pierden su fijación si falla su unión o se libera su soporte. Una cubierta inclinada se libera al perder sus dos fijaciones; la losa, al quedar menos de tres de sus cuatro apoyos. En este último caso las fijaciones restantes se marcan como perdidas por soporte. Las conexiones distinguen internamente sobrecarga y pérdida de soporte.

Este mecanismo no resuelve elasticidad, deformaciones ni redistribución continua de tensiones y no transmite detalladamente el peso de la losa a paredes aún fijadas. La losa es un cuerpo pesado que cae al perder soporte, no una colección de planchas que vuelan con facilidad.

## Daño y criterios de lectura

- **Cubierta desprendida:** número y proporción de cuerpos de cubierta liberados. El total depende del material.
- **Paredes sin soporte:** segmentos estructurales sin conexión a la base; se cuenta pérdida de soporte aunque la pieza todavía esté vertical.
- **Secundarios desprendidos:** revestimientos o ventanas liberados; no se equiparan a falla de la estructura.
- **Uniones falladas:** todos los enlaces perdidos, incluyendo cubierta y secundarios. Los enlaces estructurales también se cuentan por separado.
- **Fachada estable:** todos sus segmentos conservan conexión a la base, desplazamiento menor de 0,05 m e inclinación menor de 5°.
- **Máximos:** mayor desplazamiento tridimensional y mayor inclinación de cualquier segmento estructural durante toda la ejecución.
- **Daño localizado:** al menos una unión estructural falla o un segmento se libera, conservando más de dos fachadas estables.
- **Pérdida de soporte:** dos o menos fachadas estables, sin alcanzar el criterio de colapso.
- **Colapso del modelo:** al menos el 50 % de los segmentos estructurales supera 45° de inclinación o baja más de 0,8 m desde su posición inicial.

Perder solo la cubierta o los revestimientos no clasifica la estructura como colapsada. Los máximos de movimiento son históricos; el estado estructural mostrado corresponde al estado actual de la ejecución. Los trazos de rotura de la escena están asociados a uniones estructurales falladas y son esquemáticos, sin representar tensiones ni microgrietas calculadas.

Las colisiones de muros y entramados usan cajas completas: puertas y ventanas son visuales. Frontones, molduras y elementos del terreno son decorativos y no tienen colisionador propio. El suelo es un plano estático. La corrección de penetración contra ese plano es específica y no representa detección continua general entre todos los cuerpos.

## Reproducibilidad y pruebas

La simulación usa un paso fijo de 1/120 s. Reiniciar construye un mundo nuevo, todas las piezas y sus uniones, limpiando contactos, velocidades, daños y máximos. El catálogo y la trayectoria no usan aleatoriedad física.

La comparación crea un mundo nuevo para cada perfil compatible y utiliza la misma cubierta, velocidad, radio, refuerzo y cantidad de pasos. Las combinaciones excluidas se identifican, no se sustituyen silenciosamente. El cálculo vive en un Web Worker y no utiliza tiempo del renderizado ni opciones visuales. Se puede cancelar y volver a ejecutar sin alterar la escena.

Las pruebas cubren todas las combinaciones sin viento, rechazo de entradas inválidas, proporcionalidad del campo, daño de cubierta sin falso colapso, rotura estructural, daño secundario, soporte de losa, restricciones de conjuntos liberados, reinicio y repetición determinista. Su aprobación verifica el comportamiento programado, no valida el modelo frente a ensayos reales.

## Extensión a manzanas

Los parámetros y criterios anteriores se aplican por vivienda. Se generan 9 o 16 casas en una cuadrícula con centros separados 10, 13 o 16 m; las filas alternan orientación 180°. La mezcla de cuatro perfiles es determinista, sin ponderación censal. Todas las piezas se trasladan y rotan al sistema global y se integran una sola vez por paso en un mundo físico compartido. Los enlaces estructurales pertenecen a su casa, mientras que las colisiones pueden cruzar entre viviendas. La opción [Roturas por impacto](experimentos.md#roturas-por-impacto-v28-y-esquema-7) aplica una demanda de contacto a las uniones de la pieza receptora.

El recorrido es una recta diagonal u orientada sobre uno de los ejes, desde fuera del conjunto hasta el extremo opuesto, a 2 m/s. El campo es común a las casas y no modifica su forma por la presencia de edificios. Las casas lejanas reciben fuerza nula fuera del radio, conservando sus colisiones. El estado de cada casa usa los criterios individuales; el resumen cuenta viviendas con alguna unión fallada y viviendas con colapso del modelo. Las cantidades de piezas se suman, y los máximos de movimiento toman el mayor valor entre casas.
