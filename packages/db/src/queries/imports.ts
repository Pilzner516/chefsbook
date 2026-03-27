import { supabase } from '../client';

export interface ImportJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  source_type: 'bookmarks_html' | 'url_list' | 'single_url';
  total_urls: number;
  processed_urls: number;
  failed_urls: number;
  created_at: string;
  completed_at: string | null;
}

export interface ImportJobUrl {
  id: string;
  job_id: string;
  user_id: string;
  url: string;
  folder_name: string | null;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'duplicate' | 'not_recipe';
  recipe_id: string | null;
  error_message: string | null;
  created_at: string;
}

export async function createImportJob(
  userId: string,
  sourceType: ImportJob['source_type'],
): Promise<ImportJob> {
  const { data, error } = await supabase
    .from('import_jobs')
    .insert({ user_id: userId, source_type: sourceType })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to create import job');
  return data as ImportJob;
}

export async function addUrlsToJob(
  jobId: string,
  userId: string,
  urls: { url: string; folder_name?: string }[],
): Promise<ImportJobUrl[]> {
  const rows = urls.map((u) => ({
    job_id: jobId,
    user_id: userId,
    url: u.url,
    folder_name: u.folder_name ?? null,
  }));

  const { data, error } = await supabase
    .from('import_job_urls')
    .insert(rows)
    .select();
  if (error) throw error;

  // Update total_urls count on the job
  await supabase
    .from('import_jobs')
    .update({ total_urls: urls.length, status: 'processing' })
    .eq('id', jobId);

  return (data ?? []) as ImportJobUrl[];
}

export async function getJobProgress(jobId: string): Promise<{
  total: number;
  processed: number;
  failed: number;
  status: ImportJob['status'];
}> {
  const { data } = await supabase
    .from('import_jobs')
    .select('total_urls, processed_urls, failed_urls, status')
    .eq('id', jobId)
    .single();
  if (!data) throw new Error('Import job not found');
  return {
    total: data.total_urls,
    processed: data.processed_urls,
    failed: data.failed_urls,
    status: data.status as ImportJob['status'],
  };
}

export async function getFailedUrls(jobId: string): Promise<ImportJobUrl[]> {
  const { data } = await supabase
    .from('import_job_urls')
    .select('*')
    .eq('job_id', jobId)
    .in('status', ['failed', 'not_recipe'])
    .order('created_at');
  return (data ?? []) as ImportJobUrl[];
}

export async function markUrlComplete(
  urlId: string,
  recipeId: string,
): Promise<void> {
  await supabase
    .from('import_job_urls')
    .update({ status: 'success', recipe_id: recipeId })
    .eq('id', urlId);
}

export async function markUrlFailed(
  urlId: string,
  errorMessage: string,
  status: 'failed' | 'not_recipe' | 'duplicate' = 'failed',
): Promise<void> {
  await supabase
    .from('import_job_urls')
    .update({ status, error_message: errorMessage })
    .eq('id', urlId);
}

export async function updateJobCounters(jobId: string): Promise<void> {
  // Count statuses from the URL rows directly
  const { data: urls } = await supabase
    .from('import_job_urls')
    .select('status')
    .eq('job_id', jobId);

  const all = urls ?? [];
  const processed = all.filter((u) => u.status !== 'queued' && u.status !== 'processing').length;
  const failed = all.filter((u) => u.status === 'failed').length;
  const total = all.length;
  const done = processed === total;

  await supabase
    .from('import_jobs')
    .update({
      processed_urls: processed,
      failed_urls: failed,
      status: done ? 'complete' : 'processing',
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', jobId);
}

export async function getQueuedUrls(
  jobId: string,
  limit = 10,
): Promise<ImportJobUrl[]> {
  const { data } = await supabase
    .from('import_job_urls')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'queued')
    .order('created_at')
    .limit(limit);
  return (data ?? []) as ImportJobUrl[];
}

export async function checkDuplicateSourceUrl(
  userId: string,
  sourceUrl: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .eq('user_id', userId)
    .eq('source_url', sourceUrl)
    .limit(1);
  return data?.[0]?.id ?? null;
}
