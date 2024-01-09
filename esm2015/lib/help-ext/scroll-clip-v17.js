/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Gets whether an element is scrolled outside of view by any of its parent scrolling containers.
 * @param element Dimensions of the element (from getBoundingClientRect)
 * @param scrollContainers Dimensions of element's scrolling containers (from getBoundingClientRect)
 * @returns Whether the element is scrolled out of view
 * @docs-private
 */
export function isElementScrolledOutsideView(element, scrollContainers) {
    return scrollContainers.some(containerBounds => {
        const outsideAbove = element.bottom < containerBounds.top;
        const outsideBelow = element.top > containerBounds.bottom;
        const outsideLeft = element.right < containerBounds.left;
        const outsideRight = element.left > containerBounds.right;
        return outsideAbove || outsideBelow || outsideLeft || outsideRight;
    });
}
/**
 * Gets whether an element is clipped by any of its scrolling containers.
 * @param element Dimensions of the element (from getBoundingClientRect)
 * @param scrollContainers Dimensions of element's scrolling containers (from getBoundingClientRect)
 * @returns Whether the element is clipped
 * @docs-private
 */
export function isElementClippedByScrolling(element, scrollContainers) {
    return scrollContainers.some(scrollContainerRect => {
        const clippedAbove = element.top < scrollContainerRect.top;
        const clippedBelow = element.bottom > scrollContainerRect.bottom;
        const clippedLeft = element.left < scrollContainerRect.left;
        const clippedRight = element.right > scrollContainerRect.right;
        return clippedAbove || clippedBelow || clippedLeft || clippedRight;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nyb2xsLWNsaXAtdjE3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LWhlbHAtZXh0L3NyYy9saWIvaGVscC1leHQvc2Nyb2xsLWNsaXAtdjE3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQVFIOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxPQUFtQixFQUFFLGdCQUE4QjtJQUM5RixPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUM3QyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLGVBQWUsQ0FBQyxHQUFHLENBQUM7UUFDMUQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDO1FBQzFELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxLQUFLLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQztRQUN6RCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsSUFBSSxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUM7UUFFMUQsT0FBTyxZQUFZLElBQUksWUFBWSxJQUFJLFdBQVcsSUFBSSxZQUFZLENBQUM7SUFDckUsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLDJCQUEyQixDQUFDLE9BQW1CLEVBQUUsZ0JBQThCO0lBQzdGLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEVBQUU7UUFDakQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUM7UUFDM0QsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLENBQUM7UUFDakUsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLElBQUksR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLENBQUM7UUFDNUQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEtBQUssR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUM7UUFFL0QsT0FBTyxZQUFZLElBQUksWUFBWSxJQUFJLFdBQVcsSUFBSSxZQUFZLENBQUM7SUFDckUsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8vIFRPRE8oamVsYm91cm4pOiBtb3ZlIHRoaXMgdG8gbGl2ZSB3aXRoIHRoZSByZXN0IG9mIHRoZSBzY3JvbGxpbmcgY29kZVxuLy8gVE9ETyhqZWxib3Vybik6IHNvbWVkYXkgcmVwbGFjZSB0aGlzIHdpdGggSW50ZXJzZWN0aW9uT2JzZXJ2ZXJzXG5cbi8qKiBFcXVpdmFsZW50IG9mIGBET01SZWN0YCB3aXRob3V0IHNvbWUgb2YgdGhlIHByb3BlcnRpZXMgd2UgZG9uJ3QgY2FyZSBhYm91dC4gKi9cbnR5cGUgRGltZW5zaW9ucyA9IE9taXQ8RE9NUmVjdCwgJ3gnIHwgJ3knIHwgJ3RvSlNPTic+O1xuXG4vKipcbiAqIEdldHMgd2hldGhlciBhbiBlbGVtZW50IGlzIHNjcm9sbGVkIG91dHNpZGUgb2YgdmlldyBieSBhbnkgb2YgaXRzIHBhcmVudCBzY3JvbGxpbmcgY29udGFpbmVycy5cbiAqIEBwYXJhbSBlbGVtZW50IERpbWVuc2lvbnMgb2YgdGhlIGVsZW1lbnQgKGZyb20gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KVxuICogQHBhcmFtIHNjcm9sbENvbnRhaW5lcnMgRGltZW5zaW9ucyBvZiBlbGVtZW50J3Mgc2Nyb2xsaW5nIGNvbnRhaW5lcnMgKGZyb20gZ2V0Qm91bmRpbmdDbGllbnRSZWN0KVxuICogQHJldHVybnMgV2hldGhlciB0aGUgZWxlbWVudCBpcyBzY3JvbGxlZCBvdXQgb2Ygdmlld1xuICogQGRvY3MtcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFbGVtZW50U2Nyb2xsZWRPdXRzaWRlVmlldyhlbGVtZW50OiBEaW1lbnNpb25zLCBzY3JvbGxDb250YWluZXJzOiBEaW1lbnNpb25zW10pIHtcbiAgcmV0dXJuIHNjcm9sbENvbnRhaW5lcnMuc29tZShjb250YWluZXJCb3VuZHMgPT4ge1xuICAgIGNvbnN0IG91dHNpZGVBYm92ZSA9IGVsZW1lbnQuYm90dG9tIDwgY29udGFpbmVyQm91bmRzLnRvcDtcbiAgICBjb25zdCBvdXRzaWRlQmVsb3cgPSBlbGVtZW50LnRvcCA+IGNvbnRhaW5lckJvdW5kcy5ib3R0b207XG4gICAgY29uc3Qgb3V0c2lkZUxlZnQgPSBlbGVtZW50LnJpZ2h0IDwgY29udGFpbmVyQm91bmRzLmxlZnQ7XG4gICAgY29uc3Qgb3V0c2lkZVJpZ2h0ID0gZWxlbWVudC5sZWZ0ID4gY29udGFpbmVyQm91bmRzLnJpZ2h0O1xuXG4gICAgcmV0dXJuIG91dHNpZGVBYm92ZSB8fCBvdXRzaWRlQmVsb3cgfHwgb3V0c2lkZUxlZnQgfHwgb3V0c2lkZVJpZ2h0O1xuICB9KTtcbn1cblxuLyoqXG4gKiBHZXRzIHdoZXRoZXIgYW4gZWxlbWVudCBpcyBjbGlwcGVkIGJ5IGFueSBvZiBpdHMgc2Nyb2xsaW5nIGNvbnRhaW5lcnMuXG4gKiBAcGFyYW0gZWxlbWVudCBEaW1lbnNpb25zIG9mIHRoZSBlbGVtZW50IChmcm9tIGdldEJvdW5kaW5nQ2xpZW50UmVjdClcbiAqIEBwYXJhbSBzY3JvbGxDb250YWluZXJzIERpbWVuc2lvbnMgb2YgZWxlbWVudCdzIHNjcm9sbGluZyBjb250YWluZXJzIChmcm9tIGdldEJvdW5kaW5nQ2xpZW50UmVjdClcbiAqIEByZXR1cm5zIFdoZXRoZXIgdGhlIGVsZW1lbnQgaXMgY2xpcHBlZFxuICogQGRvY3MtcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFbGVtZW50Q2xpcHBlZEJ5U2Nyb2xsaW5nKGVsZW1lbnQ6IERpbWVuc2lvbnMsIHNjcm9sbENvbnRhaW5lcnM6IERpbWVuc2lvbnNbXSkge1xuICByZXR1cm4gc2Nyb2xsQ29udGFpbmVycy5zb21lKHNjcm9sbENvbnRhaW5lclJlY3QgPT4ge1xuICAgIGNvbnN0IGNsaXBwZWRBYm92ZSA9IGVsZW1lbnQudG9wIDwgc2Nyb2xsQ29udGFpbmVyUmVjdC50b3A7XG4gICAgY29uc3QgY2xpcHBlZEJlbG93ID0gZWxlbWVudC5ib3R0b20gPiBzY3JvbGxDb250YWluZXJSZWN0LmJvdHRvbTtcbiAgICBjb25zdCBjbGlwcGVkTGVmdCA9IGVsZW1lbnQubGVmdCA8IHNjcm9sbENvbnRhaW5lclJlY3QubGVmdDtcbiAgICBjb25zdCBjbGlwcGVkUmlnaHQgPSBlbGVtZW50LnJpZ2h0ID4gc2Nyb2xsQ29udGFpbmVyUmVjdC5yaWdodDtcblxuICAgIHJldHVybiBjbGlwcGVkQWJvdmUgfHwgY2xpcHBlZEJlbG93IHx8IGNsaXBwZWRMZWZ0IHx8IGNsaXBwZWRSaWdodDtcbiAgfSk7XG59XG4iXX0=