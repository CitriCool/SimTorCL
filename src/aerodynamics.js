// SI: density kg/m³, speed m/s, dynamic pressure Pa. The density default is
// the existing educational setting, not a measurement of Chilean conditions.
export function dynamicPressure(speed, density = 1.225) {
  return 0.5 * density * speed ** 2;
}
