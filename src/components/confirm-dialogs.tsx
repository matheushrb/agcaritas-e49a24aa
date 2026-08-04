import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Perguntar antes de sair com alterações não salvas. */
export function UnsavedChangesDialog({
  open, onOpenChange, onDiscard, onSave, saving, title = "Alterações não salvas",
  description = "Você tem alterações que ainda não foram salvas. O que deseja fazer?",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDiscard: () => void;
  onSave: () => void;
  saving?: boolean;
  title?: string;
  description?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[10000]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="outline" onClick={onDiscard}>Sair sem salvar</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar e sair"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Confirmação de exclusão. */
export function ConfirmDeleteDialog({
  open, onOpenChange, onConfirm, pending,
  title = "Excluir item?",
  description = "Esta ação não pode ser desfeita.",
  confirmLabel = "Excluir",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[10000]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
          >
            {pending ? "Excluindo…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
