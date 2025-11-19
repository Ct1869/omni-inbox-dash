import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  failedRows: { row: number; email: string; provider: string; error: string }[];
}

export function BulkAccountImport() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
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

  const validateCSV = async (file: File) => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const errors: string[] = [];

      if (lines.length < 2) {
        errors.push('CSV file is empty or has no data rows');
        setValidationErrors(errors);
        setIsValidating(false);
        return;
      }

      // Check header
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const requiredColumns = ['email', 'provider', 'access_token', 'refresh_token'];
      const missingColumns = requiredColumns.filter(col => !header.includes(col));

      if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Validate first 10 rows for quick feedback
      const emailIdx = header.indexOf('email');
      const providerIdx = header.indexOf('provider');
      const accessTokenIdx = header.indexOf('access_token');
      const refreshTokenIdx = header.indexOf('refresh_token');

      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const values = lines[i].split(',').map(v => v.trim());

        if (values.length !== header.length) {
          errors.push(`Row ${i + 1}: Column count mismatch (expected ${header.length}, got ${values.length})`);
          continue;
        }

        if (emailIdx >= 0 && !values[emailIdx]) {
          errors.push(`Row ${i + 1}: Missing email`);
        }

        if (providerIdx >= 0 && values[providerIdx] && !['gmail', 'outlook'].includes(values[providerIdx].toLowerCase())) {
          errors.push(`Row ${i + 1}: Invalid provider "${values[providerIdx]}" (must be "gmail" or "outlook")`);
        }

        if (accessTokenIdx >= 0 && !values[accessTokenIdx]) {
          errors.push(`Row ${i + 1}: Missing access_token`);
        }

        if (refreshTokenIdx >= 0 && !values[refreshTokenIdx]) {
          errors.push(`Row ${i + 1}: Missing refresh_token`);
        }
      }

      setValidationErrors(errors);

      if (errors.length > 0) {
        toast({
          title: 'CSV Validation Failed',
          description: `Found ${errors.length} error(s). Please fix and re-upload.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'CSV Valid ✓',
          description: `Ready to import ${lines.length - 1} account(s)`,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setValidationErrors([`Failed to read CSV: ${errorMsg}`]);
      toast({
        title: 'Validation Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const exportFailedRows = () => {
    if (!result || result.failedRows.length === 0) return;

    const csvContent = [
      'row,email,provider,error',
      ...result.failedRows.map(row =>
        `${row.row},"${row.email}","${row.provider}","${row.error.replace(/"/g, '""')}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed_imports_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: `Exported ${result.failedRows.length} failed row(s)`,
    });
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
      const failedRows: { row: number; email: string; provider: string; error: string }[] = [];
      const totalAccounts = lines.length - 1; // Exclude header

      // Initialize progress
      setProgress({ current: 0, total: totalAccounts, success: 0, failed: 0 });

      // Process accounts in batches of 10
      const batchSize = 10;
      for (let i = 1; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);

        await Promise.all(batch.map(async (line, batchIdx) => {
          const rowNumber = i + batchIdx;
          try {
            const values = line.split(',').map(v => v.trim());
            const email = values[emailIdx];
            const provider = values[providerIdx];
            const accessToken = values[accessTokenIdx];
            const refreshToken = values[refreshTokenIdx];
            const expiresAt = values[expiresAtIdx] || new Date(Date.now() + 3600000).toISOString();

            if (!email || !provider || !accessToken || !refreshToken) {
              throw new Error(`Missing required fields`);
            }

            if (provider !== 'gmail' && provider !== 'outlook') {
              throw new Error(`Invalid provider "${provider}". Must be "gmail" or "outlook"`);
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
                throw new Error(`Account already exists`);
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
            const values = line.split(',').map(v => v.trim());
            const email = values[emailIdx] || 'unknown';
            const provider = values[providerIdx] || 'unknown';

            errors.push(`Row ${rowNumber + 1}: ${email} - ${errorMsg}`);
            failedRows.push({
              row: rowNumber + 1,
              email,
              provider,
              error: errorMsg
            });
          }
        }));

        // Update progress after each batch
        const currentProgress = Math.min(i + batchSize - 1, totalAccounts);
        setProgress({
          current: currentProgress,
          total: totalAccounts,
          success: successCount,
          failed: failedCount
        });

        // Rate limiting between batches
        if (i + batchSize < lines.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setResult({ success: successCount, failed: failedCount, errors, failedRows });

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${successCount} accounts. ${failedCount} failed.${failedCount > 0 ? ' Click "Export Failed Rows" to download.' : ''}`,
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
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setCsvFile(file);
              setResult(null);
              if (file) {
                validateCSV(file);
              } else {
                setValidationErrors([]);
              }
            }}
            disabled={importing || isValidating}
          />
          {isValidating && (
            <p className="text-sm text-muted-foreground">Validating CSV...</p>
          )}
          <Button
            onClick={handleImport}
            disabled={!csvFile || importing || validationErrors.length > 0 || isValidating}
            className="w-full gap-2"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importing...' : 'Import Accounts'}
          </Button>
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && !importing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">CSV Validation Errors ({validationErrors.length}):</p>
                <ul className="list-disc list-inside text-sm space-y-1 max-h-40 overflow-y-auto">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
                <p className="text-xs mt-2">Please fix these errors and re-upload the CSV file.</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Progress indicator during import */}
        {importing && progress.total > 0 && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Import Progress</span>
                <span className="text-muted-foreground">
                  {progress.current} of {progress.total} accounts
                </span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} className="h-2" />
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-medium">{progress.success} succeeded</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-red-600 font-medium">{progress.failed} failed</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Processing in batches of 10 accounts... This may take several minutes for large imports.
            </p>
          </div>
        )}

        {result && (
          <Alert variant={result.failed > 0 ? 'destructive' : 'default'}>
            {result.failed > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    Success: {result.success} | Failed: {result.failed}
                  </p>
                  {result.failed > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportFailedRows}
                      className="gap-2"
                    >
                      <Upload className="h-3 w-3" />
                      Export Failed Rows
                    </Button>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">Detailed Errors:</p>
                    <ul className="list-disc list-inside max-h-40 overflow-y-auto space-y-0.5">
                      {result.errors.slice(0, 10).map((error, idx) => (
                        <li key={idx} className="text-xs">{error}</li>
                      ))}
                      {result.errors.length > 10 && (
                        <li className="text-xs font-medium">... and {result.errors.length - 10} more errors</li>
                      )}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Tip: Click "Export Failed Rows" to download a CSV with all failed accounts and their errors.
                    </p>
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

