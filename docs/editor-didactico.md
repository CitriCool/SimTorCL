# Plan integrado: construir, simular y entender

Actualizado el 3 de noviembre de 2026. Integra la propuesta de una interfaz didáctica con los pendientes del [roadmap maestro](../ROADMAP.md). B2 está implementada en v2.6 y B3 en v2.7; las etapas posteriores conservan sus pendientes. Consulta [uso, formato y límites del editor](editor.md).

## Punto de partida

Ya existen viviendas y cubiertas configurables, generación de barrios, árboles y bancos con uniones rompibles, edificios residenciales de 2 a 5 pisos con núcleo fijo, biblioteca de experimentos, eventos, inspección, repetición, comparaciones y exportaciones. La biblioteca de parámetros y el caso analítico de v2.5 aportan trazabilidad y verificación numérica; las resistencias siguen pendientes de calibración física.

El editor sobre las parcelas actuales está disponible en B2 (v2.6); B3 está disponible en [el taller v2.7](taller.md); la siguiente entrega es C. El respaldo técnico continúa durante su desarrollo y en las entregas posteriores. Los pendientes físicos no se eliminan ni se consideran resueltos por mejorar la interfaz.

## B2: construir la manzana — implementada en v2.6

Relacionada con URB-06/07, UX-01/02/06 y PRO-01/08/09.

- [x] Dar protagonismo al terreno, con paleta de infraestructuras y panel de propiedades del objeto seleccionado. Ofrecer vista superior para colocar y perspectiva para revisar.
- [x] Permitir arrastrar una casa, edificio o área verde sobre una parcela. Inicialmente el parque conserva su conjunto de árboles y bancos; la colocación independiente de estos objetos corresponde a B3.
- [x] Ofrecer también seleccionar el elemento y después su destino, mediante clic, toque o controles de teclado. El arrastre no será la única forma de construir.
- [x] Mostrar una vista previa con ajuste a la parcela/cuadrícula. Indicar ubicación válida o inválida mediante texto o símbolos además del color; impedir superposición indebida con construcciones, accesos y calles.
- [x] Seleccionar, mover, rotar, duplicar y eliminar objetos; permitir deshacer y rehacer. Una colocación inválida conserva el objeto y la distribución anterior.
- [x] Configurar por objeto los atributos disponibles: perfil y cubierta de viviendas, pisos de edificios y tipo de uso de parcela. Los controles deben respetar las combinaciones y límites físicos del catálogo.
- [x] Separar el modo de edición del cálculo y de la repetición. Editar requiere un escenario intacto; ofrecer guardar resultados antes de reconstruir y explicar qué acción los descarta.
- [x] Guardar explícitamente el plano manual con identificadores, posiciones, orientaciones y propiedades. La semilla conserva su papel en la generación inicial; no sustituye la geometría editada.
- [x] Versionar el formato de experimento y validar las ediciones antes de sustituir el escenario activo. Conservar importación, repetición y recálculo de los archivos anteriores.
- [x] Verificar colocación, selección, deshacer/rehacer, reglas geométricas, estabilidad sin viento y correspondencia entre representación, colisión y piezas físicas. Comprobar guardado/carga con geometría idéntica en escritorio y móvil.

**Criterio de cierre:** crear una manzana con casa, edificio y parque, corregir una acción, guardar y cargar sin alterar sus propiedades, y simularla con los controles existentes. La edición no exige que ya existan trayectorias libres ni calles editables.

## B3: preparar la simulación y entender el daño — implementada en v2.7

Relacionada con URB-08/09/12, VER-02/04, FIS-08/09, UX-03/04/05 y PRO-12. Reutiliza EXP-06 a EXP-10, ya disponibles, y las amplía al plano editado.

- [x] Ampliar la paleta a árboles y bancos colocados individualmente, con identificadores persistentes, geometría válida y participación en el inventario y la física. Otras especies y mobiliario permanecen como ampliación posterior.
- [x] Permitir dibujar y guardar la trayectoria sobre el terreno; controlar intensidad, traslación y duración de forma comprensible y con unidades.
- [x] Incorporar ejemplos modificables: residencial, barrio mixto, plaza con edificios y viviendas reforzadas. Mantener visible cuándo una distribución es sintética.
- [x] Añadir una guía inicial corta y ayudas contextuales para colocar, configurar, ejecutar y revisar resultados. Dejar parámetros avanzados en un panel desplegable, con fuentes y supuestos accesibles.
- [x] Seleccionar construcciones, objetos o piezas desde la escena para consultar daños y recorrer sus eventos en la línea de tiempo.
- [x] Explicar causas que constan en el registro, por ejemplo una unión sobrecargada o pérdida de soporte; indicar cuando un mecanismo no se calcula. Un contacto por sí solo no debe describirse como una nueva rotura por impacto.
- [x] Facilitar la lectura visual del estado inicial y dañado y la comparación de alternativas. Conservar el plano editado y las identidades al variar únicamente el refuerzo; diferenciar los cambios deliberados de geometría.

**Criterio de cierre:** una persona modifica un ejemplo, define un recorrido, lo ejecuta y encuentra una explicación respaldada por eventos; puede recuperar el diseño y repetir una comparación sin reconstruirlo manualmente.

## C: completar los mecanismos físicos pendientes

El editor utilizará inicialmente la física disponible. La ampliación de estos mecanismos requiere entregas y comprobaciones propias:

| Área | Pendiente conservado | Referencias |
| --- | --- | --- |
| Impactos | Rotura adicional por fragmentos, origen y receptor, cadenas causales y tratamiento de colisiones rápidas | FIS-01/02/03/04 |
| Edificios | Plantas y alturas configurables, usos y componentes adicionales, modelo resistente respaldado y resultados por piso/fachada; colapso estructural como ampliación propia | EDI-01 a EDI-05, EDI-07, EDI-11 |
| Viviendas | Adobe, emergencia y variantes de planta, cubierta y base con comportamiento y fuentes propios | EDI-09/10/11 |
| Vegetación | Clases de árbol y geometría, parámetros de rotura y anclaje con fuentes, más distribución y métricas de daños | VER-01 a VER-04, VER-06/07/10 |
| Cargas y uniones | Presión interior, cambios tras aberturas, redistribución, conexiones elásticas y estados de daño por tipología | FIS-05/06/07/11 |

**Criterio por mecanismo:** demanda y capacidad con unidades y procedencia, prueba aislada, evento explicable y estabilidad numérica comprobada. El núcleo fijo de un edificio no se presentará como una estructura que puede colapsar hasta contar con ese modelo.

## D: respaldo técnico transversal desde B2

- [ ] Revisar fuentes oficiales de clasificación y fuentes técnicas completas de propiedades, registrando institución, edición, sección/página, condiciones y límites. El Censo no aporta por sí solo resistencia mecánica.
- [ ] Ampliar la biblioteca con datos publicados o derivados, diferenciados de los supuestos educativos; versionar cualquier cambio del modelo físico.
- [ ] Seleccionar un caso físico pequeño con datos independientes, definir errores y aceptación, y contrastar sus resultados. Conservar el caso analítico actual como verificación del programa.
- [ ] Estudiar sensibilidad a masas, resistencias, anclajes y viento, y estabilidad frente al paso temporal y discretización.
- [ ] Mantener el nivel de evidencia visible en el editor, el ensayo y los informes, sin sobrecargar los controles básicos.

Referencias: VAL-01 a VAL-05/08/10. Cada mecanismo físico nuevo debe incorporar su propia verificación y procedencia; adelantar el editor no elimina estos requisitos.

## B4 / E / F: ampliación posterior

Se mantienen en el roadmap completo:

- Calles, parcelas y terrenos de forma libre; densidades y proporciones por tipología, edificios altos, catálogo urbano y vegetal ampliado (URB-03/11, EDI-02/03, VER-01/02).
- Rendimiento, límites de escena y detalle gráfico/físico, trabajos en segundo plano, accesibilidad, regresiones y publicación de versiones estables (PRO-03 a PRO-11).
- Selección por región o comuna, inventarios geográficos, alturas y materiales con procedencia, relieve e importación de modelos territoriales (GEO-01 a GEO-09).
- Incertidumbre, conjuntos reproducibles de simulaciones, probabilidades y funciones de fragilidad respaldadas (VAL-06/07/09).
- Viento modificado por edificios y vegetación y conexión con CFD, con verificación de campos, presiones y cambios tras el daño (CFD-01 a CFD-08, VER-08/09, FIS-10).
- Respuesta de suelo y fundaciones, diferenciando contactos con el plano, fallo de anclaje y deformación real (FIS-12, EDI-11, GEO-07).
- Costos, escombros, pérdida de uso, recuperación, exposición y comparación de mitigaciones cuando existan modelos y datos de consecuencias (CON-01 a CON-07).

La secuencia expresa prioridades y dependencias, sin comprometer fechas. Las casillas marcadas corresponden a B2/B3 verificadas en v2.6/v2.7; las abiertas conservan trabajo pendiente.
