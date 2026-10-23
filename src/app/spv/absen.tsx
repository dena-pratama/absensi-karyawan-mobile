import { CheckScreen } from "@/components/attendance/CheckScreen";
import { useSpv } from "@/lib/spv";

/** Absen SPV: check in lalu check out, dengan memilih outlet dari cabang-cabang yang dipegang. */
export default function SpvAbsen() {
  const { branches } = useSpv();
  return <CheckScreen outlets={branches} />;
}
