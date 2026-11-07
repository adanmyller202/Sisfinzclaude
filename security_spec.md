# SisFinz Firestore Security Specification

## Data Invariants
1. A user's private financial records (`users/{userId}/...` including `bills`, `incomes`, `expenses`, `finance_settings`, `goals`, `savings`, `monthly_status`, `categories`, `settings`, `achievements`, `fifty_two_week_challenges`) belong exclusively to `{userId}`.
2. An authenticated user `userA` CANNOT read, list, update, or delete any records under `users/{userB}` where `userB != userA`.
3. Shared bills (`shared_bills/{billId}`) are accessible ONLY to members specified in `resource.data.members`. Users not listed in `members` receive PERMISSION_DENIED on all read, update, delete, and list operations.
4. Shared transfers (`shared_transfers/{transferId}`) are immutable once created (`allow update, delete: if false`). They are visible ONLY to `fromUserId` or `toUserId`.
5. Shared invitations (`shared_invitations/{invitationId}`) are visible and editable ONLY by `fromUserId` or `toUserId`.
6. Notifications (`shared_notifications/{notificationId}`) are readable and managed ONLY by `userId`.
7. `user_directory/{userId}` allows public read for signed-in users (to find partners by email), but write access is strictly limited to `{userId}`.

## The Dirty Dozen Security Tests
1. **Unauthenticated Read on User Data**: Unauthenticated client attempts `get` on `users/victim_123/finance_settings/main` -> EXPECT: PERMISSION_DENIED.
2. **Cross-User Private Read**: User `attacker_456` attempts `get` on `users/victim_123/finance_settings/main` -> EXPECT: PERMISSION_DENIED.
3. **Cross-User Private Write/Overwrite**: User `attacker_456` attempts `setDoc` or `updateDoc` on `users/victim_123/incomes/salary` -> EXPECT: PERMISSION_DENIED.
4. **Cross-User Private Delete**: User `attacker_456` attempts `deleteDoc` on `users/victim_123/expenses/rent` -> EXPECT: PERMISSION_DENIED.
5. **Unauthorized Shared Bill Sniffing**: User `stranger_789` attempts `getDoc` on `shared_bills/sbill_secret` where `stranger_789` is NOT in `members` -> EXPECT: PERMISSION_DENIED.
6. **Unauthorized Shared Bill Query**: User `stranger_789` attempts `getDocs` on `shared_bills` without a filter on `members` -> EXPECT: PERMISSION_DENIED.
7. **Fake Member Shared Bill Injection**: User `attacker_456` attempts `setDoc` on `shared_bills/sbill_hack` where `members` is `['victim_123', 'other_user']` (excluding `attacker_456`) -> EXPECT: PERMISSION_DENIED.
8. **Transfer Record Modification**: User `attacker_456` attempts `updateDoc` or `deleteDoc` on `shared_transfers/stran_123` -> EXPECT: PERMISSION_DENIED.
9. **Notification Tampering**: User `attacker_456` attempts `deleteDoc` on `shared_notifications/notif_victim` owned by `victim_123` -> EXPECT: PERMISSION_DENIED.
10. **User Directory Impersonation**: User `attacker_456` attempts `setDoc` on `user_directory/victim_123` -> EXPECT: PERMISSION_DENIED.
11. **Subcollection Crawl Attack**: User `attacker_456` attempts `getDocs` on `users/victim_123/goals` -> EXPECT: PERMISSION_DENIED.
12. **Settings/Balance Overwrite**: User `attacker_456` attempts `setDoc` on `users/victim_123/finance_settings/main` setting `currentBalance: 999999` -> EXPECT: PERMISSION_DENIED.
