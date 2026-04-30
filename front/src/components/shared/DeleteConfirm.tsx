import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface DeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
}

export const DeleteConfirm = ({ open, onOpenChange, onConfirm, title }: DeleteConfirmProps) => {
  const { t, dir } = useLanguage();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="neu-flat rounded-3xl bg-background border-none" dir={dir}>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-cairo">{title || t.deleteConfirm}</AlertDialogTitle>
          <AlertDialogDescription className="font-cairo">{t.deleteWarning}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          <AlertDialogCancel className="font-cairo rounded-xl">{t.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground font-cairo rounded-xl">{t.delete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
