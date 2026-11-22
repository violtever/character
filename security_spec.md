# Security Specification — xocyberluv's character archive

## Data Invariants
1. **Public Read / Admin Write Archive**: `/characters`, `/categories`, and `/gallery` are readable by Guests, Users, and Admins. Only verified Admins (`request.auth.token.email_verified == true` and bootstrapped admin email or `/admins/{uid}`) may create, update, or delete records.
2. **Strict Role Immutability**: Standard users registering via `/users/{uid}` MUST only create documents with `role == 'user'`. Regular users can NEVER modify their `role` field or write to `/admins/{uid}`.
3. **PII Isolation**: `/users/{uid}` contains `email` and is strictly readable only by the owner (`isOwner(uid)`) or a verified Admin (`isAdmin()`). `/usernames/{username}` contains zero PII.
4. **Personal Favorites Integrity**: `/users/{uid}/favorites/{characterId}` is accessible only by the verified owner (`isOwner(uid)`), requires `userId == request.auth.uid`, and verifies that `/characters/{characterId}` exists before creation.
5. **Temporal & Structural Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time`; `createdAt`, `uid`, and `createdBy` are immutable on update; every string and array field is bounded in size; all document keys are strictly allowlisted with `hasOnly`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Guest Character Create**: Unauthenticated `POST /characters/ARC-999` → Denied.
2. **User Privilege Escalation on Signup**: Authenticated user creating `/users/{uid}` with `{ role: "admin" }` → Denied.
3. **User Self-Upgrade on Update**: Authenticated user updating `/users/{uid}` changing `role: "admin"` → Denied.
4. **User Admin Allowlist Injection**: Authenticated user writing `/admins/{uid}` → Denied.
5. **Email Spoofing Admin**: Unverified token (`email_verified: false`) matching admin email attempting to create `/characters/ARC-100` → Denied.
6. **User Character Mutation**: Verified `user` attempting to update or delete `/characters/ARC-001` → Denied.
7. **Shadow Field Injection**: Admin creating `/characters/ARC-009` with extra ghost field `isSystemOverride: true` → Denied by `hasOnly`.
8. **ID Poisoning**: Creating `/characters/../../etc/passwd` or 200-char ID → Denied by `isValidId`.
9. **Cross-User PII Read**: Verified `userA` attempting `get /users/userB` or `list /users` → Denied.
10. **Orphaned Favorite**: Verified user creating `/users/{uid}/favorites/NON_EXISTENT` → Denied by `exists(/characters/...)`.
11. **Timestamp Forgery**: Admin creating `/characters/ARC-010` with client-forged `createdAt: 2020-01-01` → Denied by `createdAt == request.time`.
12. **Array Overflow / Value Poisoning**: Admin updating `/characters/ARC-001` with 25 tags or oversized string → Denied by `isValidCharacter`.
