"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CsvImportModal({
  onClose,
  campaignId,
  listId,
}: {
  onClose: () => void;
  campaignId?: string | null;
  listId?: string | null;
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const Papa = (await import("papaparse")).default;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const { createSupabaseBrowserClient } =
              await import("@/lib/supabase/client");
            const supabase = createSupabaseBrowserClient();

            // Upload to storage for archiving
            const timestamp = new Date().getTime();
            const fileName = `${campaignId || "global"}_${timestamp}.csv`;

            await supabase.storage.from("csv_imports").upload(fileName, file);
          } catch (storageErr) {
            console.error("Failed to archive CSV:", storageErr);
          }

          const { importProspectsCSV } = await import("@/lib/flows/import");
          const res = await importProspectsCSV(
            campaignId || null,
            results.data as Record<string, unknown>[],
            listId || null,
          );
          if (res.success) {
            router.refresh();
            onClose();
          } else {
            setError(res.error || "Erreur lors de l'import");
            setIsUploading(false);
          }
        },
        error: (err) => {
          setError("Erreur de lecture du CSV");
          setIsUploading(false);
        },
      });
    } catch (err) {
      setError("Erreur lors de l'import");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg text-white flex items-center gap-2">
            <Upload className="size-5 text-white/70" /> Importer des contacts
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Importez un fichier CSV UTF-8. Champs recommandés :{" "}
            <code className="text-xs bg-white/5 px-1 py-0.5 rounded">
              Email
            </code>
            ,{" "}
            <code className="text-xs bg-white/5 px-1 py-0.5 rounded">
              FirstName
            </code>
            ,{" "}
            <code className="text-xs bg-white/5 px-1 py-0.5 rounded">
              LastName
            </code>
            ,{" "}
            <code className="text-xs bg-white/5 px-1 py-0.5 rounded">
              CompanyName
            </code>
            ,{" "}
            <code className="text-xs bg-white/5 px-1 py-0.5 rounded">
              LinkedInURL
            </code>
            .
          </p>

          <div className="relative border-2 border-dashed border-white/20 rounded-xl p-8 hover:border-white/40 transition-colors bg-white/[0.02] text-center cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center pointer-events-none">
              {isUploading ? (
                <Loader2 className="size-8 text-emerald-500 animate-spin mb-3" />
              ) : (
                <Upload className="size-8 text-white/40 mb-3" />
              )}
              <p className="text-sm font-medium text-white">
                {isUploading
                  ? "Import en cours..."
                  : "Cliquez ou glissez un fichier CSV"}
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>
      </motion.div>
    </div>
  );
}
