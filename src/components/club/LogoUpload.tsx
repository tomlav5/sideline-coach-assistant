import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface LogoUploadProps {
  clubId: string;
  currentLogoUrl?: string | null;
  onLogoUpdate: (logoUrl: string | null) => void;
}

export function LogoUpload({ clubId, currentLogoUrl, onLogoUpdate }: LogoUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadLogo = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);

      // Create file path
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${clubId}/logo.${fileExt}`;
      const filePath = `club-logos/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('club-assets')
        .upload(filePath, selectedFile, { 
          upsert: true,
          contentType: selectedFile.type 
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('club-assets')
        .getPublicUrl(filePath);

      // Update club with new logo URL
      const { error: updateError } = await supabase
        .from('clubs')
        .update({ logo_url: publicUrl })
        .eq('id', clubId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Club logo updated successfully",
      });

      onLogoUpdate(publicUrl);
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      const { error } = await supabase
        .from('clubs')
        .update({ logo_url: null })
        .eq('id', clubId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Club logo removed successfully",
      });

      onLogoUpdate(null);
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: "Error",
        description: "Failed to remove logo",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Club Logo</CardTitle>
        <CardDescription>Upload a logo to represent your club</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            {currentLogoUrl ? (
              <img
                src={currentLogoUrl}
                alt="Club logo"
                className="w-16 h-16 rounded-lg object-cover border"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg border border-dashed border-muted-foreground flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex gap-2">
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    {currentLogoUrl ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Club Logo</DialogTitle>
                    <DialogDescription>
                      Choose an image file to use as your club logo (max 5MB)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="w-full p-2 border border-input rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                    </div>
                    
                    {previewUrl && (
                      <div>
                        <p className="text-sm font-medium mb-2">Preview:</p>
                        <img
                          src={previewUrl}
                          alt="Logo preview"
                          className="w-32 h-32 rounded-lg object-cover border"
                        />
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={uploadLogo} 
                        disabled={!selectedFile || uploading}
                        className="flex-1"
                      >
                        {uploading ? "Uploading..." : "Upload Logo"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setUploadDialogOpen(false);
                          setSelectedFile(null);
                          setPreviewUrl(null);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              {currentLogoUrl && (
                <Button variant="outline" onClick={removeLogo}>
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}