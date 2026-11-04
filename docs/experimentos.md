# Cuaderno de experimentos (desde v2.2; esquema actual 5)

Abre **Cuaderno de experimentos**, debajo de los controles de simulación. El escenario se pausa al abrirlo.

## Guardar y compartir

En Archivo puedes nombrar, guardar, cargar, duplicar y renombrar elementos de la biblioteca. Para renombrar, selecciona el elemento, escribe el nuevo nombre en el campo y pulsa Renombrar seleccionado.

- **Configuración**: parámetros actuales para construir un escenario intacto desde cero. Se puede guardar en biblioteca, exportar a JSON o compartir por enlace.
- **Ejecución**: configuración inicial, cambios de viento/radio/refuerzo, pasos calculados, resultados finales, eventos y fotogramas. Cargarla abre una repetición visual.

La biblioteca usa IndexedDB y pertenece al origen del sitio (protocolo, dominio y puerto). No hay cuenta, servidor de almacenamiento ni sincronización entre equipos. Cambiar de puerto o borrar los datos del navegador separa o elimina esta biblioteca. Exporta JSON para conservar o trasladar los experimentos.

El enlace contiene únicamente la configuración actual y el nombre, en el fragmento de la URL. Comienza una ejecución nueva; no incluye resultados ni fotogramas. Necesita una instalación compatible de SimTorCL en la dirección del enlace. Una dirección localhost solo funciona donde esté el servidor local.

## Eventos, inspección y gráficos

Cada vivienda conserva su identificador C01, C02, etc. Cada pieza y unión tiene un identificador local a esa vivienda.

El registro incluye el paso y tiempo simulado de las fallas, su demanda y capacidad en newtons y la liberación de piezas por pérdida de soporte. Las causas son sobrecarga sostenida o pérdida de soporte. Los eventos anteriores relacionados describen conexiones falladas y apoyos del grafo idealizado; no prueban una transferencia continua de cargas ni un mecanismo físico adicional.

Los filtros permiten recorrer los eventos por vivienda y tipo. **Ver evento en 3D** muestra el primer fotograma disponible en o después del evento. El evento conserva su tiempo preciso; el fotograma puede corresponder a un instante posterior.

Inspección permite elegir casa y pieza, consultar su sistema/material, masa, superficie, carga del último paso, demanda, capacidades de las conexiones y estado. También permite enfocar la cámara en esa pieza. El movimiento actual de una pared se distingue de los máximos históricos de todas las paredes del escenario.

El gráfico muestra las fracciones de cubierta desprendida y paredes sin soporte a lo largo del tiempo simulado. Son curvas muestreadas. Las métricas de desplazamiento e inclinación máximos son históricas y se borran al reiniciar.

## Repetición visual y recálculo

La repetición ofrece inicio, reproducción/pausa y navegación por fotogramas. La física se mantiene detenida y los controles de parámetros quedan bloqueados. **Volver a mi ejecución** recupera el escenario pausado anterior, incluidos sus cuerpos, velocidades y conexiones. Reiniciar sale de la grabación y construye un escenario nuevo.

Los fotogramas guardan posiciones, cuaterniones, liberación y daño de piezas. No guardan un estado completo del integrador, velocidades, contactos ni restricciones dinámicas. Por ello no permiten reanudar la física desde un fotograma. Las cargas instantáneas no están disponibles al inspeccionar una grabación.

**Recalcular y contrastar ejecución** construye un escenario nuevo desde la configuración inicial y aplica el historial de controles en los mismos pasos. Compara todas las métricas guardadas con tolerancia de `1e-6 * max(1, abs(valor))`, sin sobrescribir los resultados importados. Coincidencia numérica verifica reproducción del programa; no constituye validación experimental del modelo.

## Comparar escenarios

La comparación A/B comienza desde cero y conserva una configuración común y una duración de 10, 20 o 30 segundos. Solo cambia la condición seleccionada: refuerzo, distribución de perfiles, separación entre casas, cubierta o trayectoria. Las tres condiciones urbanas requieren una manzana. Se rechazan combinaciones de cubierta incompatibles y valores idénticos a la base A.

El cálculo usa un Web Worker, permite cancelación y conserva el experimento interactivo. Los resultados muestran el conjunto y cada vivienda; se pueden exportar a CSV. Cerrar el cuaderno cancela un cálculo pendiente.

## Exportaciones

- JSON de configuración o ejecución, con esquema, versión de aplicación, identificación del modelo, parámetros y unidades.
- CSV de viviendas y conjunto, piezas finales y eventos. La comparación tiene su propio CSV con ambas configuraciones.
- Informe HTML independiente con captura de la vista, resultados finales, configuración, historial, curvas, fuentes, parámetros y limitaciones. Puede abrirse sin conexión e imprimirse desde el navegador. Muestra hasta 200 eventos; JSON y CSV conservan todos.

La captura corresponde a la vista al exportar, que puede ser un fotograma intermedio; las tablas del informe describen el final de la ejecución. Los CSV usan UTF-8 con BOM, separador de punto y coma, comillas y unidades en los encabezados. Los textos que comienzan como fórmulas se neutralizan para abrirlos en hojas de cálculo.

## Formato y límites

El contenedor tiene `format: "simtorcl-experiment"`, `schemaVersion: 5`, `kind: "configuration"` o `"run"`, `modelId`, `model`, `name`, `initial`, `layout` y metadatos de fecha y versión. Una ejecución agrega `startedAt`, `changes`, `steps`, `realSeconds`, `results`, `events` y `frames`.

`model` identifica el algoritmo y registra catálogo, geometría, unidades, reglas, parámetros del motor/campo y fuentes. La identificación es una huella de compatibilidad, no una firma de autenticidad. Cambios del algoritmo requieren actualizar su versión. Una importación no certifica resultados: el recálculo permite contrastarlos.

El historial de controles usa `{step, key, value}`. Cada cambio se aplica antes del paso siguiente. Los eventos usan identificadores `C01:E1`, tiempo, paso, casa, pieza, tipo, causa y referencias a eventos previos. Los fotogramas contienen `step`, `stats` y `poses`: nueve números por pieza, en el orden `[x, y, z, qx, qy, qz, qw, liberada, daño]`, con el orden de generación del modelo compatible.

La importación comprueba versión, parámetros del modelo, configuración, pasos, métricas, identidades de viviendas, referencias de eventos, dimensiones de los fotogramas y cuaterniones. Rechaza archivos mayores a 40 MB, más de dos horas simuladas, más de 10 000 cambios/eventos o más de 241 fotogramas. Los extremos de la grabación deben estar presentes y el resultado final debe coincidir con el último fotograma.

El muestreo comienza cada 30 pasos (0,25 s). Se reduce de forma adaptativa para conservar ambos extremos con hasta 240 fotogramas y un presupuesto aproximado de 900 000 valores de pose. En escenas grandes o ejecuciones largas se pierde resolución temporal visual; los eventos no se submuestrean.

Se admite una migración explícita de configuración v0:

```json
{
  "format": "simtorcl-experiment",
  "schemaVersion": 0,
  "kind": "configuration",
  "name": "Ensayo anterior",
  "config": { "wind": 160 }
}
```

La migración completa parámetros omitidos con los valores predeterminados actuales y crea una configuración con el esquema actual. Los archivos v1 de v2.2 se migran al esquema 2 conservando resultados y fotogramas; su plano es `null`. El modo barrio guarda su plano regenerable en `layout` y valida su coincidencia. Consulta [el generador](barrio.md). No se migran resultados de modelos físicos distintos ni versiones desconocidas.

El reloj simulado cuenta pasos de 1/120 s. El reloj real activo cuenta tiempo de pantalla mientras la simulación está en marcha, excluyendo pausas y pestañas ocultas. El ritmo medio es tiempo simulado dividido por tiempo real activo; puede ser menor que 1× si el equipo limita el avance.

El esquema 3 incorpora `environmentModel` y `environmentInventory`. Los esquemas 1 y 2 se migran preservando el entorno visual anterior, para conservar los resultados. Los nuevos objetos físicos tienen identificadores de entidad y parcela, capacidad con unidad N o N·m, eventos, poses y resultados propios. Consulta [Entorno físico](entorno-fisico.md).

El esquema 4 incorpora `parameterLibrary`, una copia de la biblioteca de propiedades y procedencia. Los esquemas 1–3 migran con ese campo en `null`, sin añadir evidencia retrospectiva; los informes lo indican y conservan la versión de aplicación original. La nueva biblioteca y su comprobación analítica se consultan en **Parámetros y fuentes**. Consulta [alcance, fuentes y criterio](parametros.md).

El esquema 5 añade `initial.sitePlan` para el plano manual del [editor v2.6](editor.md), con identidades y propiedades por objeto. Los esquemas 1–4 migran con ese campo en `null`, conservando su geometría, procedencia disponible y resultados. Las ejecuciones manuales incluyen los objetos en eventos, inspección, poses, inventario y exportaciones; pueden recalcularse desde el plano guardado.

## Taller v2.7 y esquema 6

El [taller](taller.md) añade `route`, `travelSpeed`, `duration` y `lesson` a la configuración. `scenarioModel` describe las unidades y reglas de recorrido/tiempo cuando se usan controles nuevos. Los planos nuevos `parcel-editor-2` incorporan `items`, identificadores persistentes y posiciones discretas por parcela; el inventario físico conserva cada componente y su capacidad educativa. El informe incluye el descriptor y el CSV de parcelas lista los elementos independientes. Los enlaces de configuración admiten estos datos y siguen sin incluir resultados.

Los archivos anteriores mantienen las versiones de geometría, capacidades, procedencia disponible y resultados con las que fueron creados. La migración agrega controles predeterminados sin modificar una ejecución guardada ni atribuirle una nueva biblioteca de propiedades. El recálculo sigue siendo una acción explícita.

## Roturas por impacto v2.8 y esquema 7

Al activar **Roturas por impacto**, un fragmento liberado puede fallar uniones de una pieza todavía sujeta. El modelo toma los contactos con velocidad normal de acercamiento de al menos 0,5 m/s y suma sus fuerzas normales por par de piezas. Reparte la demanda entre los apoyos intactos del receptor y compara con sus capacidades, incluido el refuerzo. Para anclajes en N·m calcula el momento horizontal de esas fuerzas respecto al apoyo. La rotura ocurre tras el paso de contacto y puede liberar otras piezas por pérdida de soporte.

El umbral, el reparto y las capacidades son supuestos educativos. La carga estimada depende del paso de 1/120 s y del solucionador de contacto. El cálculo usa los contactos discretos del motor, por lo que puede omitir fragmentos rápidos que atraviesen piezas delgadas entre pasos. [Solucionador de Cannon-es 0.20.0](https://github.com/pmndrs/cannon-es/blob/v0.20.0/src/solver/GSSolver.ts)

El esquema 7 guarda `initial.impact` e `impactModel`. Las ejecuciones y enlaces de esquemas anteriores se migran con impactos desactivados. Los eventos de impacto incluyen la pieza receptora, la velocidad normal y el identificador del desprendimiento de origen. El cuaderno permite filtrar estos eventos y saltar a su origen. El JSON y el CSV conservan la relación.

## Barrido de fragmentos en v2.9

Al activar **Roturas por impacto** en v2.9, el modelo `swept-v2` conserva los contactos discretos y comprueba los cruces completos de un fragmento a través de piezas fijas entre dos posiciones consecutivas. Prueba el solapamiento de las cajas físicas orientadas durante el recorrido y conserva el primer obstáculo. La orientación del fragmento se fija al inicio del paso para esa consulta. [Detección con cajas orientadas, David Eberly](https://www.geometrictools.com/Documentation/DynamicCollisionDetection.pdf)

En un cruce recuperado, el modelo corrige la posición hasta el primer contacto y aplica un rebote normal simplificado. Estima la fuerza equivalente a partir del impulso normal dividido por el paso y usa las capacidades educativas existentes. El cuaderno, el JSON y el CSV identifican el barrido y su fracción del paso. El ensayo conserva el paso fijo de 1/120 s y usa su final como tiempo del evento. Quedan pendientes la rotación continua, los cruces entre fragmentos móviles y la calibración.

Para probarlo, carga **Plaza con edificios**, aplica 280 km/h y activa **Roturas por impacto**. Tras ejecutar el ensayo unos segundos, usa el filtro **Impactos por barrido** en el cuaderno. Los archivos guardados con `contact-v1` conservan la detección discreta de v2.8. Para cambiar un ensayo antiguo al barrido, apaga y vuelve a encender el interruptor.

## Vuelo de fragmentos en v2.10

Con **Vuelo sensible a la orientación**, cada pieza desprendida usa su caja física y la velocidad del aire relativa al movimiento local de sus caras. La fuerza depende del área proyectada, la presión dinámica y un coeficiente de arrastre común de 0,7. Un desplazamiento ilustrativo del centro de presión hacia el borde de ataque permite que un flujo oblicuo genere giro. La masa y la inercia de cada pieza determinan su respuesta. [Ecuación de arrastre, NASA Glenn](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/factors-that-affect-drag/)

**Comparar vuelo de fragmentos** suelta por separado una plancha metálica y un panel de fachada del catálogo bajo el mismo viento horizontal constante. Ambas piezas parten en reposo con 4 m libres hasta el suelo y una inclinación de 45° respecto al viento. El ensayo registra el desplazamiento horizontal, giro acumulado, velocidad y tiempo al primer contacto con el suelo. La fuerza y el giro son aproximaciones educativas. La calibración por material y la rotura en piezas más pequeñas quedan pendientes.

El esquema 8 guarda el descriptor de vuelo y reproduce archivos anteriores con su modelo original. Para repetir el ejemplo de impacto por barrido de v2.9 en una sesión nueva, desactiva **Vuelo sensible a la orientación** antes de iniciar el ensayo.

## Presión interior de viviendas en v2.11

**Presión interior de viviendas** ofrece un recinto inicialmente cerrado y una abertura frontal equivalente de 1 m². Con el modelo activo, los huecos de ventanas, revestimientos, paredes y cubiertas desprendidas participan en el balance en el paso siguiente. El recinto toma la presión con la que los caudales de entrada y salida se equilibran. El modelo usa la raíz cuadrada de la diferencia de presión y un área de fuga ilustrativa de 0,1 m² a presión ambiente. [Referencia de balance de caudal y orificios, NIST](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=915632)

La presión se mide respecto al ambiente. Puede ser positiva en barlovento y negativa en sotavento. Se suma a la carga exterior en las superficies intactas, incluidas las fijaciones de la cubierta. La abertura frontal inicial representa un área de ventilación para el cálculo. La geometría de colisión sigue representando la envolvente original. Cada vivienda se calcula como un recinto independiente. Quedan pendientes los edificios de varios pisos, los compartimentos, los transitorios y la calibración de los coeficientes.

El selector muestra la presión aplicada y el área de aberturas durante el ensayo. En una manzana muestra el rango de presiones y el área total, y el JSON conserva los valores por vivienda. El esquema 9 guarda el modelo y carga los ensayos de v2.10 y anteriores con presión interior desactivada.
