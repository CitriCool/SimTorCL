# SimTorCL

Laboratorio 3D interactivo para explorar el efecto de un campo de viento similar a un tornado sobre una vivienda chilena de albañilería y cubierta de zinc.

Construido con **Vite, Three.js y Cannon-es**, sin un framework de interfaz. La geometría, las texturas, la vegetación y las partículas se generan en código.

Las tipografías DM Sans y Space Grotesk se incluyen localmente a través de Fontsource. Las licencias de las tipografías y bibliotecas se distribuyen en `public/licenses/`. La aplicación compilada no requiere Google Fonts ni otros servicios externos para funcionar.

![Interfaz del laboratorio SimTorCL](docs/simtorcl.jpg)

## Ejecutar localmente

Requiere Node.js **22.12 o superior** (recomendado: Node 24 LTS) y un navegador moderno con WebGL 2.

```sh
git clone https://github.com/CitriCool/SimTorCL.git
cd SimTorCL
npm ci
npm run dev
```

Abre la dirección que muestra Vite, normalmente http://127.0.0.1:5173. Si ese puerto está ocupado, usa `npm run dev -- --port 5174`.

```sh
npm test          # Pruebas del campo de viento, cubierta, muros y reinicio
npm run build    # Genera la versión estática en dist/
npm run preview  # Sirve localmente la versión compilada
```

## Controles

| Control                    | Función                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| Iniciar / Pausar o Espacio | Controlar el tiempo de simulación                                   |
| Reiniciar o R              | Reconstruir la casa y restablecer el tiempo, conservando parámetros |
| Suave / Fuerte / Extremo   | Seleccionar una velocidad ilustrativa de viento                     |
| Velocidad                  | Ajustar entre 60 y 280 km/h                                         |
| Radio                      | Ajustar entre 4 y 12 metros                                         |
| Resistencia                | Cambiar la fuerza necesaria para liberar planchas aún fijadas       |
| Mostrar vórtice            | Activar la representación visual sin modificar la física            |
| Radio de influencia        | Mostrar u ocultar el límite del campo de viento                     |
| Botones de cámara          | Vista en perspectiva, superior y frontal                            |
| Arrastrar / rueda          | Orbitar y acercar la cámara                                         |

Los atajos no interfieren con controles de formulario. Al cambiar de pestaña, la simulación se pausa para evitar saltos de tiempo.

## Modelo físico

- Mundo con gravedad de 9,82 m/s² y un paso fijo de **1/60 s**, independiente de la frecuencia de renderizado. El tiempo acumulado por cuadro está limitado a 0,1 s para evitar inestabilidad; en dispositivos lentos puede avanzar más despacio que el reloj real.
- Cuatro muros dinámicos de 800 kg por pieza. Suelos y contactos resueltos con `SAPBroadphase` y 15 iteraciones del solver.
- 16 planchas de 0,8 kg dispuestas en dos aguas. Antes del desprendimiento son cuerpos estáticos que representan una fijación idealizada. Tras una sobrecarga sostenida de 0,12 s se convierten en cuerpos dinámicos.
- Campo de viento móvil con una componente tangencial, una componente hacia el centro y succión vertical. Usa una presión proporcional a `0.5 × 1.225 × (velocidad / 3.6)²`, atenuada por la distancia radial.
- La resistencia de fijación y el peso de la plancha determinan el desprendimiento. La carga sobre los muros se reduce explícitamente para conservar el comportamiento solicitado: pérdida de cubierta antes del vuelco de los muros.
- Después de desprenderse, las planchas reciben fuerzas y momentos, caen por gravedad y colisionan con el suelo, los muros y otras planchas.
- La fuerza se aplica antes de cada paso físico y el punto de aplicación es relativo al cuerpo.

**Alcance:** demostración educativa con coeficientes calibrados visualmente. No es un cálculo aerodinámico ni un análisis estructural. No modela anclajes de albañilería, deformaciones, rotura de materiales, presión interior ni interacción fluido-estructura. Los vanos de puertas y ventanas, frontones, tapajuntas, vegetación y cercos son decorativos, sin colisión propia. Las velocidades predefinidas no son categorías oficiales de intensidad. La masa de los muros y las cargas son parámetros ilustrativos, no valores certificados de una vivienda real.

## Estructura

```text
index.html              Interfaz accesible en español
src/main.js             Controles y bucle de tiempo fijo
src/physics.js          Modelo Cannon-es independiente del navegador
src/scene.js            Escena Three.js, vivienda y efectos procedurales
src/style.css           Diseño adaptable a escritorio y móvil
test/physics.test.js    Pruebas reproducibles del comportamiento físico
.github/workflows/ci.yml  Pruebas y compilación en GitHub Actions
```

## Distribuir

`npm run build` produce un sitio estático en `dist/`. La base relativa permite servirlo desde una subcarpeta, incluido GitHub Pages. Puedes publicar el contenido de esa carpeta en cualquier alojamiento estático. El repositorio incluye CI que comprueba cada cambio y guarda `dist` como artefacto; no activa un despliegue por sí solo.

Los PDF originales utilizados como referencia permanecen fuera del control de versiones. `node_modules`, resultados compilados, temporales y variables de entorno también se excluyen.

## Documentación de las bibliotecas

- [Three.js](https://threejs.org/docs/)
- [Cannon-es](https://pmndrs.github.io/cannon-es/docs/)
- [Vite](https://vite.dev/guide/)
