"use client";

import { useState } from "react";

import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DangerZoneTab() {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteWorkspace() {
    setIsDeleting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsDeleting(false);
    toast.error("Workspace deletion is not available in this demo yet.");
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Danger Zone</h3>
        <p className="text-muted-foreground text-sm">Destructive actions that cannot be undone.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium">Transfer ownership</p>
              <p className="text-muted-foreground text-sm">Give another member full ownership of this workspace.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>
            Transfer
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium">Delete workspace</p>
              <p className="text-muted-foreground text-sm">
                Permanently delete this workspace and all of its data. This action cannot be undone.
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the workspace, agents, knowledge sources, conversations, and messages.
                  Type <strong>delete</strong> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                placeholder="Type 'delete' to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText !== "delete" || isDeleting}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDeleteWorkspace();
                  }}
                >
                  {isDeleting && <Loader2 className="size-4 animate-spin" />}
                  Delete workspace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
