# Car Care Prototype: Requirements Brief

This file is the single source of truth for the Car Care website prototype.
Every feature built must trace back to an ID in this file.

## 1. What Car Care is

Car Care is an independent, multi-brand car service and maintenance web app (it is NOT tied to a dealership).
Car owners and service centers each register and log in separately. The app stores the date each
part of a car was installed and its estimated expiry date, and it notifies both the owner and the
service center when a part is due. The service center then contacts the owner, picks the car up from
the owner's home, inspects it, sends a list of damaged parts with a cost estimate, services the parts
the owner selects, updates the new expiry dates, and the owner pays online.

**Business goal:** build customer loyalty by keeping a line of communication open with customers and
reminding them when their car/parts need service (current returning-customer rate is low).

## 2. Users (roles)

| Role | Who | Can do |
|---|---|---|
| Car Owner (customer) | Vehicle owner | Register, log in, manage vehicles, view part status, get reminders, request service, accept/decline service, select parts, pay, view history, report/feedback to admin |
| Service Center (servicer / technician) | Service center employee | Register, log in, see customers needing service, send service requests, enter/modify car parts info, create cost estimates, log services, update part expiry, manage inventory and part shipments |
| Manager | Service center manager | Everything Service Center can, plus inventory/shipment approval and reports |
| Admin | Platform admin | Manage user accounts, maintain vehicle model catalog, review owner reports, view system-wide data. Requires 2-step login |
| Payment Service Provider | External (simulated) | Processes Net Banking / UPI / card payments |

## 3. Functional requirements (from Assignment 4 interview)

- **FR-02** The system shall allow an authenticated user to submit a request and receive an order number or an error message.
- **FR-03** The system shall allow an authenticated user to submit a service request and recommend a provider (service center) or alternatives to choose from.
- **FR-04** The system shall prompt consumers (car owners) with reminders of service updates.
- **FR-05** The system shall prompt host users (service centers) with reminders of consumers who need serviced parts.
- Interview evidence: inventory is tracked through the system; part shipments are scheduled through the system; registration and login for servicer and customer; notifications for customers whose parts need maintenance.

## 4. Nonfunctional requirements

- **NFR-01** The system shall be available to customers 24/7 (hosted on GitHub Pages; no "closed" hours for the website itself).
- **NFR-02** The system shall only schedule appointments between 8:00 AM and 5:00 PM.
- **NFR-03** The system shall update parts and warehouse inventory automatically once a request has been sent/confirmed.

## 5. Data requirements

- **DR-01** The system shall retrieve information based on past services (service history per vehicle).
- **DR-02** The system shall log services when they occur (date, center, technician, parts changed, cost).

## 6. Security / privacy / access

- **SR-01** The system shall allow the servicer to access warehouse (inventory) information.
- **SR-02** The system shall allow customers to access their vehicle information.
- **SR-03** The system shall NOT allow customers to access store inventory.
- **SR-04** The system shall NOT allow servicers to see customers' SSN.

## 7. Business rules

- **BR-01** Each manager and admin has their own individual login. Accounts cannot be shared.
- **BR-02** Admin accounts require a second authentication step (authenticator app/device; simulated in prototype).
- **BR-03** Only the assigned admin can access their authentication device/code.
- **BR-04** Vehicle information must be kept current as new vehicle models are released.
- **BR-05** Managers and admins have access to functions regular users do not (role-based access).
- **BR-06** A new vehicle model must be added to the system before it can be scheduled for service (open question Q-04: allow manual entry of an unlisted vehicle, flagged for admin review).

## 8. Constraints

- **C-01** Individual accounts only; admin needs to create, disable, and reset accounts.
- **C-02** Admin access needs a second auth step plus a recovery process for a lost device.
- **C-03 / C-04** Vehicle model data cannot be static; there must be an ongoing way to add new models.

## 9. Use cases from the case study (Group 14 UML)

1. **Registration**: profiles for car owner and service center. If already registered, go to login.
2. **Login**: correct password grants access; incorrect password shows error + "Forgot password".
3. **Vehicle Information System**: maintains vehicle info; sends notification when a part's expiry date is reached.
4. **Views Information**: owner and service center see the condition/status of the car's parts.
5. **Enters and Modifies Car Parts Information**: service center updates part info after every service.
6. **Vehicle Parts Expiry Notification**: owner and service center are notified; service center contacts the owner and asks for service.
7. **Service Acceptance**: owner accepts (continue) or declines the service request. On accept, the car is picked up from the owner's home.
8. **Service Cost Estimation for All Damaged Parts**: service center inspects the car, creates a list of damaged parts with costs, and sends it in the app.
9. **Parts Selection and Service Confirmation**: owner selects which parts to service and confirms (or cancels).
10. **Updating Changed Parts Expiry Information**: service center records changed parts and new expiry dates.
11. **Online Payment**: owner pays after service is complete, via the payment service provider.
12. **Net Banking**: one payment method.
13. **UPI**: another payment method (owner may choose any other method, e.g. card).
14. **Report**: after service and payment, owner can report a problem or give positive feedback to the admin.

Class diagram data (use these field names):
- Vehicle Owner: ownerName, ownerId, vehicleNumber, vehicleMake, carModel, year, address
- Service Center: serviceCenterId, serviceCenterName, serviceCenterAddress
- Admin: adminPassword, authenticate
- Vehicle Information: parts[], expiryDates[], isPartExpired[], damagedParts[], selectedPartsForService[], serviceCompleted
- Payment Service Provider: providerId, transactionId, amount, paymentSuccessful

## 10. Prototype technical constraints

- Plain HTML, CSS, and vanilla JavaScript only (no frameworks, no build step, no backend) so it runs on GitHub Pages.
- Data persists in the browser with localStorage and is seeded with realistic demo data on first load.
- All payment, MFA, and email/SMS notifications are simulated in the UI and clearly labeled as simulated.
- Use fake demo data only. SSNs are fake (e.g. 123-45-6789) and only ever shown masked.
