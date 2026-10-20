import { Button, MessageScreen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Akun admin tidak memakai app mobile — semua pengelolaan ada di panel web. */
export default function Admin() {
  const { signOut } = useAuth();
  return (
    <MessageScreen
      title="Gunakan panel web"
      message="Akun admin dikelola lewat panel web di www.denaprojects.web.id. Aplikasi mobile ini khusus untuk karyawan dan SPV cabang."
    >
      <Button label="Keluar" variant="outline" onPress={signOut} />
    </MessageScreen>
  );
}
