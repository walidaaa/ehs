import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CrudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export const CrudDialog = ({ open, onOpenChange, title, children }: CrudDialogProps) => {
  const { dir } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neu-flat rounded-3xl bg-background border-none max-w-lg" dir={dir}>
        <DialogHeader>
          <DialogTitle className="font-cairo text-lg">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
