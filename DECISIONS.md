# Task 1: SOLID Priciples in OrdersService:

I found the biggest SOLID improvement potential in the functions:

- createOrder
- updateOrder
- generateOrderReport

#### createOrder

1. The function was 'responsible' for many things beyond the creation of the Order. (Single Responsibility Procniple)

After validating customer and location the function

    - Checked and updated the available product stocks
    - counted ordered items and calculated the subtotal
    - decided on and calculated the updated final order price (discount + tax)
    - effectively created the newly populated Order
    - notified customer with the order confirmation.

`Action Taken`

-Extracted some of the related functionality into functions within the orderService (calculateSubtotalAndItems)
-Created service classes for the different responsibilities:
-InventoryService: handles the stock validation and updates it.
-PricingService: handles final price calculation
-NotificationService: handles the 'sending' of notification emails (replaced console logs with logger)

-Wrapped the functionality into a transaction: if the core functionality of createOrder fails/throws at any step, the whole operation is cancelled in order to avoid partial updates.

#### updateOrder

1. Also in violation of SRP:
   -checked hand handled if the update included order status
   -effectively updated the order instance
   -notified customer in case status updated to shipped.

`Action Taken`
-Extracted the status update check into separate function (within service)
-To be consistent with the createOrder, I also used a transaction for this function. Perhaps not 100% necessary in this case, though.
-Extracted customer notification -->> I originally had a NotificationService interface with a sendOrderConfirmation that the actual service could implement. Adding another function to that would've neant having to implement both functions, which makes no sense. So I abstracted the interface to just Notification with a sendNotification function and some decision making on what notification to send depending on the notification type (enum). (DIP). This still kind of bothers me as it does not really solve OpenClose, having to write a new switch case for every new notification type...

-Although a failed sending of the notification does not cancel/rollback the transaction, i decided to move that block to the bottom, physically outside the transaction block.

#### generateOrderReport

I was going to move that whole logic out into the reportService (which i did). After having a look at the controller, which now called the orderService to just call the reportService, I replaced the return statement of the controller with the call to reportService, not going through the orderService at all.

# Task 2: Implement Rate Limiting

Had to do some reading into rate limiting and the nest throttler package.
The configuration about what rate we want to limit is specified in the orderModule's import of the ThrottlerModule (Not more thqan 10 requests per minute from the same location).
By default, the ThrottlerGuard uses IP addresses to limit rates -> it selects the IP as a key that gets passed to Redis to keep track off.
We can overwrite the guard's generateKey function to set a custom key – in our case the location. The locationId gets returned by the generateKey function and the guard handles the rest.

# Task 3: Database Querying Issue

The main problem causing performance issues was the fetching of the order items, where every items was done by an individual query.
Had to look for the Prisma equivalent to batch queries in TypeOrm.
By grouping/finding all items by id into one query, we reduce queries by n-1.
The throwing for unavailable/unvalid/not-found products gets now moved down as the batch query won't throw
The validation and stock update happens looping through a hashmap generated from the queried items.
The update/save query to the database is also batched for all the validated order items, outside of any loops.

# Task 4: Implement Comprehensive Unit Tests

Implemented unit tests for orderService and all other additional service files/functions.
Given the extend of the project and limited time, for this task i got the most help from ChatGPT, which helped me with speed. Reviewed all tests thoroughly for correctness.

#### Particular testing of the rate limit guard:

While unit tests help with ensuring code correctness, I thought it'd make sense to test the limit guard more practically. Instead of sending requests via postman, I ran a script that hit the createOrder endpoint 10+ times from the same and different locations.

## Pricing and Notifications can be extracted into their own services

### Pricing specifically:

The way the rates for taxes are calculated does not comply with the open close principle:
if a new location is introduced (eg. Germany), we'd have to write a new else if to add thr german tax to it.
I'll extract this logic and create a rate map. (I'll explore using strategies for this instead if I have time...)
