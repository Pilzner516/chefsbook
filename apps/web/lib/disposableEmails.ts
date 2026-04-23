// Common disposable email domains — extend as needed
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'temp-mail.org',
  'throwaway.email', 'yopmail.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'dispostable.com', 'maildrop.cc', 'spamgourmet.com',
  'getairmail.com', 'filzmail.com', 'throwam.com',
  'tempinbox.com', 'spambox.us', 'binkmail.com',
  'bobmail.info', 'dayrep.com', 'discard.email',
  'discardmail.com', 'fakeinbox.com', 'filzmail.com',
  'fleckens.hu', 'getonemail.com', 'gowikibooks.com',
  'incognitomail.com', 'mailnull.com', 'mailslite.com',
  'spamfree24.org', 'spamgob.com', 'superrito.com',
  'tempr.email', 'trbvm.com', 'wegwerfmail.de',
  '10minutemail.com', 'minutemail.com', 'tempmail.net',
  'emailondeck.com', 'mohmal.com', 'mytemp.email',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}
