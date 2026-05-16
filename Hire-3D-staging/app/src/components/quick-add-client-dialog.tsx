import { ClientForm } from '@/components/client-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

type QuickAddClientDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (clientId: string) => void
}

export function QuickAddClientDialog({
  open,
  onOpenChange,
  onCreated
}: QuickAddClientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Add Client</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Create a new client record and assign it to an operator.
          </p>
        </DialogHeader>
        <ClientForm
          submitLabel="Create"
          submittingLabel="Creating…"
          onSuccess={id => {
            onOpenChange(false)
            onCreated(id)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
