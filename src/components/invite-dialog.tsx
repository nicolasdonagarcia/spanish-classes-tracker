"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createInvite } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

export function whatsappUrl({ token, name, team, phone }: { token: string; name?: string; team: string; phone?: string }) {
  const hello = name ? `¡Hola, ${name}!` : "¡Hola!";
  const text = `${hello} Te invito a registrar tus clases en "${team}". Crea tu cuenta aquí: ${inviteUrl(token)}`;
  const digits = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function copyInvite(token: string) {
  try {
    await navigator.clipboard.writeText(inviteUrl(token));
    toast.success("Enlace copiado");
  } catch {
    toast.error("No se pudo copiar. Mantén presionado el enlace para copiarlo.");
  }
}

export function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.31-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41" />
    </svg>
  );
}

export function InviteDialog({ team, trigger }: { team: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function reset() {
    setName("");
    setPhone("");
    setToken(null);
    setCopied(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full">
            <UserPlus />
            Invitar profesor/a
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!token ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createInvite(name);
                if (!res.ok) return void toast.error(res.error);
                setToken(res.token);
              });
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>Invitar profesor/a</DialogTitle>
              <DialogDescription>
                Te daremos un enlace para enviarle por WhatsApp. Con él crea su cuenta y entra a tu equipo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="invite-name">Nombre (opcional)</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ana"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-phone">WhatsApp (opcional)</Label>
              <Input
                id="invite-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                inputMode="tel"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Con código de país. Si lo dejas vacío, eliges el contacto en WhatsApp.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                {pending && <Loader2 className="animate-spin" />}
                Crear enlace
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>¡Enlace listo!</DialogTitle>
              <DialogDescription>
                Envíaselo{name ? ` a ${name}` : ""}. Funciona una sola vez y vence en 14 días.
              </DialogDescription>
            </DialogHeader>
            <Button
              asChild
              size="lg"
              className="bg-[#1fa855] text-white hover:bg-[#1a9149]"
            >
              <a href={whatsappUrl({ token, name, team, phone })} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="size-5" />
                Enviar por WhatsApp
              </a>
            </Button>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl(token)} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
              <Button
                variant="outline"
                onClick={async () => {
                  await copyInvite(token);
                  setCopied(true);
                }}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
