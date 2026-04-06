/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 14/06/2025 - 01:05:10
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 14/06/2025
    * - Author          : 
    * - Modification    : 
**/

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, File, Check, X, ArrowRight, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useUser } from "@/hooks/use-user";
import { Card } from "@/components/ui/card";

interface LabUploadProps {
  onUploadSuccess?: () => void;
  maxFiles?: number;
  allowedFileTypes?: {
    [key: string]: string[];
  };
  uploadEndpoint?: string;
}

const defaultAllowedTypes = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/*': ['.png', '.jpg', '.jpeg']
};

export default function LabUpload({ 
  onUploadSuccess, 
  maxFiles = 5,
  allowedFileTypes = defaultAllowedTypes,
  uploadEndpoint = '/api/labs'
}: LabUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useUser();

  // Early return for free tier users
  if (user?.subscriptionTier === 'free') {
    return (
      <Card className="p-6 text-center relative bg-muted/30">
        <Lock className="mx-auto h-12 w-12 text-blue-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Lab Analysis Feature</h3>
        <p className="text-gray-700 mb-4">
          Want in-depth analysis of bloodwork or other biomarker tests? Upgrade to get access.
        </p>
        <Link to="/subscription-page">
          <Button className="w-full bg-blue-600 hover:bg-blue-700">
            Upgrade Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </Card>
    );
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // For core tier, limit to 3 files total
    if (user?.subscriptionTier === 'core') {
      const totalFiles = (user.labUploadsCount || 0) + acceptedFiles.length;
      if (totalFiles > 3) {
        toast({
          title: "Upload limit reached",
          description: "Core tier is limited to 3 lab uploads. Upgrade to Pro for unlimited uploads.",
          variant: "destructive"
        });
        return;
      }
    }

    setFiles(prev => {
      const newFiles = [...prev, ...acceptedFiles];
      return newFiles.slice(0, maxFiles);
    });
  }, [maxFiles, user]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedFileTypes,
    maxFiles,
    multiple: true
  });

  const handleUpload = async () => {
    try {
      setUploading(true);

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 429) {
            toast({
              title: "Upload limit reached",
              description: (
                <div className="flex flex-col gap-2">
                  <span>{data.message}</span>
                  <Link to="/subscription-page" className="text-primary hover:underline">
                    Upgrade to Pro <ArrowRight className="h-4 w-4 inline" />
                  </Link>
                </div>
              ),
              variant: "destructive"
            });
            return;
          }
          throw new Error(data.message || 'Upload failed');
        }
      }

      setFiles([]);
      toast({
        title: "Success",
        description: (
          <div className="flex items-center gap-2">
            <span className="text-yellow-500 text-xl">★</span>
            <span>Ask StackChat about your results</span>
            <Link to="/" className="text-primary hover:underline ml-1">
              <ArrowRight className="h-4 w-4 inline" />
            </Link>
          </div>
        ),
        duration: 3000
      });
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload lab results",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setUploading(false);
    }
  };

  const allowedExtensions = Object.values(allowedFileTypes)
    .flat()
    .map(ext => ext.replace('.', '').toUpperCase())
    .join(', ');

  const uploadLimit = user?.subscriptionTier === 'core' ? 3 : Infinity;
  const remainingUploads = uploadLimit - (user?.labUploadsCount || 0);

  return (
    <div className="space-y-4">
      {user?.subscriptionTier === 'core' && (
        <div className="text-sm text-muted-foreground mb-2">
          Remaining uploads: {remainingUploads} of {uploadLimit}
        </div>
      )}
      
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 font-medium">Drag & drop lab files here, or click to select</p>
        <p className="text-sm text-muted-foreground mt-1">
          Supported formats: {allowedExtensions}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Maximum {maxFiles} file{maxFiles !== 1 ? 's' : ''} per upload
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={file.name} className="flex items-center justify-between p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2 text-sm">
                <File className="h-4 w-4" />
                <span className="truncate max-w-[200px]">{file.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button 
            onClick={handleUpload} 
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <span>Uploading...</span>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Upload {files.length} file{files.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
