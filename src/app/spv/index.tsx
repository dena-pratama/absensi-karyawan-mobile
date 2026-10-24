import { CheckScreen } from "@/components/attendance/CheckScreen";
import { useSpv } from "@/lib/spv";

/** Absen SPV / Office: check in lalu check out, memilih outlet (SPV: cabangnya; Office: semua cabang aktif). */
export default function SpvAbsen() {
  const { checkinBranches } = useSpv();
  return <CheckScreen outlets={checkinBranches} />;
}
