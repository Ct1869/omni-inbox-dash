import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export function BulkAccountImport() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = `email,provider,access_token,refresh_token,expires_at
example1@gmail.com,gmail,ya29.a0...,1//0g...,2024-12-31T23:59:59Z
example2@outlook.com,outlook,EwB4A8...,M.C5...,2024-12-31T23:59:59Z`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_accounts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast({
        title: 'Error',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
      }

      // Parse CSV header
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const emailIdx = header.indexOf('email');
      const providerIdx = header.indexOf('provider');
      const accessTokenIdx = header.indexOf('access_token');
      const refreshTokenIdx = header.indexOf('refresh_token');
      const expiresAtIdx = header.indexOf('expires_at');

      if (emailIdx === -1 || providerIdx === -1 || accessTokenIdx === -1 || refreshTokenIdx === -1) {
        throw new Error('CSV must have columns: email, provider, access_token, refresh_token, expires_at');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process accounts in batches of 10
      const batchSize = 10;
      for (let i = 1; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (line, batchIdx) => {
          try {
            const values = line.split(',').map(v => v.trim());
            const email = values[emailIdx];
            const provider = values[providerIdx];
            const accessToken = values[accessTokenIdx];
            const refreshToken = values[refreshTokenIdx];
            const expiresAt = values[expiresAtIdx] || new Date(Date.now() + 3600000).toISOString();

            if (!email || !provider || !accessToken || !refreshToken) {
              throw new Error(`Missing required fields in row ${i + batchIdx + 1}`);
            }

            if (provider !== 'gmail' && provider !== 'outlook') {
              throw new Error(`Invalid provider "${provider}" in row ${i + batchIdx + 1}. Must be "gmail" or "outlook"`);
            }

            // Insert email account
            const { data: account, error: accountError } = await supabase
              .from('email_accounts')
              .insert({
                user_id: user.id,
                email,
                provider,
                is_active: true,
              })
              .select()
              .single();

            if (accountError) {
              if (accountError.code === '23505') { // Unique constraint violation
                throw new Error(`Account ${email} already exists`);
              }
              throw accountError;
            }

            // Insert OAuth tokens
            const { error: tokenError } = await supabase
              .from('oauth_tokens')
              .insert({
                account_id: account.id,
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: expiresAt,
              });

            if (tokenError) throw tokenError;

            successCount++;
          } catch (error) {
            failedCount++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push(`Row ${i + batchIdx + 1}: ${errorMsg}`);
          }
        }));

        // Rate limiting between batches
        if (i + batchSize < lines.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setResult({ success: successCount, failed: failedCount, errors });

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${successCount} accounts. ${failedCount} failed.`,
        variant: failedCount > 0 ? 'destructive' : 'default',
      });

    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Account Import</CardTitle>
        <CardDescription>
          Import multiple email accounts from a CSV file. Download the template to see the required format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Template
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            disabled={importing}
          />
          <Button 
            onClick={handleImport} 
            disabled={!csvFile || importing}
            className="w-full gap-2"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importing...' : 'Import Accounts'}
          </Button>
        </div>

        {result && (
          <Alert variant={result.failed > 0 ? 'destructive' : 'default'}>
            {result.failed > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">
                  Success: {result.success} | Failed: {result.failed}
                </p>
                {result.errors.length > 0 && (
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">Errors:</p>
                    <ul className="list-disc list-inside max-h-40 overflow-y-auto">
                      {result.errors.slice(0, 10).map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {result.errors.length > 10 && (
                        <li>... and {result.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

