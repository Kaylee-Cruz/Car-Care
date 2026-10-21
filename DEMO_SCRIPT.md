# Car Care MS Teams Demo Script

## Presenter assignments

- **Presenter 1 — Owner onboarding:** register a new owner, add an approved vehicle and an unlisted vehicle, and explain the review flow.
- **Presenter 2 — Service center workflow:** add initial part records to the new vehicle, send a service request, prepare the estimate, and complete service.
- **Presenter 3 — Owner service and payment:** accept the request, confirm parts, review updated records, demonstrate failed and successful payment, and submit feedback.
- **Presenter 4 — Admin and access control:** complete admin MFA, review the report, approve the pending vehicle, manage an account and model, and demonstrate the owner redirect.

Use four presenters if available. With three, Presenter 1 can also cover the admin flow, or Presenter 2 can cover the redirect at the end.

## Demo accounts

All seeded demo accounts use password `demo123`.

| Role | Email | Password |
|---|---|---|
| Car Owner | `owner@carcare.demo` | `demo123` |
| Car Owner | `owner2@carcare.demo` | `demo123` |
| Service Center Manager | `manager@carcare.demo` | `demo123` |
| Service Center Technician | `technician@carcare.demo` | `demo123` |
| Service Center Manager | `center2@carcare.demo` | `demo123` |
| Admin | `admin@carcare.demo` | `demo123` |

The Admin login also requires the six-digit code displayed in that account’s **Simulated Authenticator Device** panel. Use fake contact details and fake SSNs only. Payments, notifications, credentials, and the authenticator are prototype simulations.

## Before the call

1. Open the site in a browser (or start Live Server) and select **Reset demo data** in the footer once. Confirm the prompt, then return to the landing page.
2. Share the browser window in Teams and explain that data is stored in localStorage in this browser.
3. Use one browser profile for the live walkthrough so registration, requests, inventory, and reports share the same demo data.
4. On owner registration, use a unique email such as `carcare.owner.demo@example.test`, an eight-character-or-longer password, and fake contact/SSN information.
5. Keep the second owner vehicle’s pending-review row available for the Admin presenter.

## Recording walkthrough

### 1. Public landing and owner registration — Presenter 1

1. Show the independent, multi-brand service explanation and **Available 24/7** on `index.html`.
2. Open Register, create a Car Owner account, then add a listed vehicle (for example, a Honda Civic). Point out the unique user ID and masked-only SSN display.
3. In the owner portal, add a second vehicle using **My vehicle isn’t listed**. Show that it is labeled **Pending admin review** and cannot be scheduled yet.

**Requirement IDs:** NFR-01; BR-06; SR-02; Use cases 1 and 3.

### 2. Initial vehicle information and center request — Presenter 2

1. Log in as `manager@carcare.demo` / `demo123` and open **Vehicle Information**.
2. Search for the new listed vehicle by its vehicle number. Because it has no assigned service center yet, saving its initial part records assigns it to this center.
3. Add a few demo part records with a mix of expired, due-soon, and OK expiry dates, then save. Return to Dashboard and show the owner under **Customers needing service**.
4. Select **Send Service Request**. Point out that the owner is notified and the generated order number appears in Service Requests.
5. Open the request, select **Mark Car Picked Up**, then **Create Cost Estimate**. Add at least two parts and labor amounts, show the running total, and send the estimate.

**Requirement IDs:** FR-04; FR-05; SR-01; SR-04; DR-01; DR-02; Use cases 3, 4, 5, 6, 8, and 10.

### 3. Owner notification, acceptance, and time validation — Presenter 3

1. Log in as the new owner and show the center-request notification and the request under **Service Requests**.
2. Choose **Accept and choose pickup**. Try **7:00 PM** first and show the 8:00 AM–5:00 PM validation error; then select a future date and an allowed time such as **3:00 PM**, confirm the home pickup address, and submit.
3. Open the estimate, select the parts to service, check the total, and select **Confirm Service**.

**Requirement IDs:** FR-02; FR-04; NFR-02; Use cases 6, 7, and 9.

### 4. Parts reservation and service completion — Presenter 2

1. Return to the Manager account and reopen the confirmed request. Show reserved quantities in Inventory and the inventory activity entries for the order.
2. Select **Start Service**. Enter or keep the suggested install and expiry dates for each changed part and select **Complete Service**.
3. Show the request as Completed, the new expiry dates, the service-history record, and inventory on-hand quantities reduced with reservations cleared.

**Requirement IDs:** NFR-03; SR-01; DR-01; DR-02; Use cases 5 and 10.

### 5. Owner history, payment, and feedback — Presenter 3

1. Return to the owner account. In **My Vehicles**, show the updated part status; in **Service History**, show the completed service and payment due.
2. Open the request and choose UPI. Use a fake ID such as `demo.owner@bank`, check **Simulate a failed payment**, and submit. Show that no payment is recorded and the invoice remains due.
3. Uncheck the failure option and submit again. Show the simulated receipt and the Paid status.
4. Submit a 1–5 star Positive Feedback or Complaint and confirm the report appears as submitted.

**Requirement IDs:** DR-01; FR-04; Use cases 3, 4, 11, 12, 13, and 14.

### 6. Admin review and catalog maintenance — Presenter 4

1. Log in as `admin@carcare.demo` / `demo123`; enter the current six-digit code from the simulated authenticator panel.
2. Open **Reports & Feedback** and show the owner’s submitted report. Optionally add a note and mark it Reviewed or Action Taken.
3. In **Pending vehicles**, approve the unlisted vehicle and show it added to the catalog. Explain that approval unlocks service scheduling.
4. In **User Management**, create an individual Manager account assigned to a service center, then disable and re-enable a demo user. Do not use a shared account.
5. In **Vehicle Model Catalog**, add a new make/model/year (or import a model year) and point out the last-updated date.

**Requirement IDs:** BR-01; BR-02; BR-03; BR-04; BR-05; BR-06; C-01; C-02; C-03; C-04; Use case 14.

### 7. Owner access boundary — Presenter 4

1. Log in as the owner and navigate directly to `center.html`.
2. Show the redirect to Login and the message that the account does not have access to that portal. Confirm the owner portal contains no inventory or shipment information.

**Requirement IDs:** SR-03; SR-04; BR-05.

## Close

Remind viewers that this is a static prototype: it uses browser localStorage, and email/SMS, payments, and MFA are simulated. Use **Reset demo data** after recording if the browser should return to the seeded starting state.
