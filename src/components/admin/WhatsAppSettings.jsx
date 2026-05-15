import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';

const STATUS_LABELS = {
  loan_submitted: 'New Loan Submitted (to approver)',
  loan_approved: 'Loan Approved (to submitter)',
  loan_rejected: 'Loan Rejected (to submitter)',
};

const SAMPLE_LOAN = {
  loan_number: 'BLP-TEST-001',
  borrower_name: 'Test Borrower',
  principal: 500000,
  branch: 'Vijay Nagar',
  cluster: 'Mysore',
  disbursement_date: '2026-05-15',
  rejection_reason: 'Insufficient collateral value',
  cluster_manager_notes: 'Approved after verification',
};

export default function WhatsAppSettings() {
  const [testPhone, setTestPhone] = useState('');
  const [testType, setTestType] = useState('loan_submitted');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    if (!testPhone) return;
    setSending(true);
    setResult(null);
    const res = await base44.functions.invoke('sendWhatsAppNotification', {
      type: testType,
      loan: SAMPLE_LOAN,
      recipients: [{ name: 'Test User', phone: testPhone }],
    });
    setResult(res.data);
    setSending(false);
  };

  const credsMissing = result?.results?.[0]?.error?.includes('not configured');

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-5">
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-green-600" />
        <h3 className="font-syne font-semibold text-sm">WhatsApp Notifications (Twilio)</h3>
        <span className="ml-auto text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">Setup Required</span>
      </div>

      {/* Setup instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-blue-800 font-semibold text-xs">
          <Info size={14} /> How to activate WhatsApp notifications
        </div>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Sign up at <a href="https://www.twilio.com" target="_blank" rel="noreferrer" className="underline font-medium">twilio.com</a> (free account)</li>
          <li>Enable WhatsApp Sandbox: Console → Messaging → Try it out → Send a WhatsApp message</li>
          <li>Go to <strong>Dashboard → Settings → Environment Variables</strong> and add:
            <ul className="ml-4 mt-1 space-y-0.5 list-disc">
              <li><code className="bg-blue-100 px-1 rounded">TWILIO_ACCOUNT_SID</code> — from Console home</li>
              <li><code className="bg-blue-100 px-1 rounded">TWILIO_AUTH_TOKEN</code> — from Console home</li>
              <li><code className="bg-blue-100 px-1 rounded">TWILIO_WHATSAPP_FROM</code> — e.g. <code className="bg-blue-100 px-1 rounded">whatsapp:+14155238886</code></li>
            </ul>
          </li>
          <li>Add phone numbers to <strong>Team Members</strong> in Master Directory</li>
          <li>Messages auto-send when loan status changes!</li>
        </ol>
      </div>

      {/* Notification triggers summary */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Auto-send Triggers</div>
        <div className="grid gap-2">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Test sender */}
      <div className="border-t border-border pt-4 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send a Test Message</div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-48">
            <Label className="text-xs">Recipient Phone (with country code)</Label>
            <Input
              placeholder="+919876543210"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1 w-56">
            <Label className="text-xs">Message Type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={testType}
              onChange={e => setTestType(e.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleTest} disabled={sending || !testPhone} className="gap-2 bg-green-600 hover:bg-green-700">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            {sending ? 'Sending…' : 'Send Test'}
          </Button>
        </div>

        {result && (
          <div className={`rounded-lg p-3 border text-sm flex items-start gap-2 ${credsMissing ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : result.results?.[0]?.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {credsMissing ? <Info size={15} className="mt-0.5 shrink-0" /> : result.results?.[0]?.success ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
            <div>
              {credsMissing
                ? 'Twilio credentials not set yet. Add them in Dashboard → Settings → Environment Variables.'
                : result.results?.[0]?.success
                  ? `Message sent! Twilio SID: ${result.results[0].sid}`
                  : `Error: ${result.results?.[0]?.error || 'Unknown error'}`
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}