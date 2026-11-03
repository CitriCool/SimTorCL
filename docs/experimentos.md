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
