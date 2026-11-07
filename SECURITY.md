# Security

This is the Fidora website: a read-only view of the Fidora program on Solana.
It holds no keys and no funds, has no wallet connection and no accounts, and
signs nothing. Its server reads a Solana RPC (localnet or devnet; mainnet is
refused) and the browser talks only to this site. The program's threat model
is in fidora-solana-programs and fidora-solana-backend; the site's summary is
at `/docs/security`.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting
on this repository ("Security" tab → "Report a vulnerability") with the page,
what you found, and a reproduction if you have one. Credit is given in the fix
commit.
