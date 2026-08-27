# Cycattle

Cycattle is a website for new cyclists in the Seattle area. The idea is to help people new to the sport discover new routes.

## Routes representation

Part of the issue with a lot of route solutions is that they have to have start and end points. People do want to be able to know how long each ride is, but depending on where they live, routes will be totally different lengths.

Rather than storing each route separately, one of the innovations of Cycattle is to represent routes as a graph of separate segments.

## Interaction

Users can create a new route by selecting segments on the map and connecting them together.

Users can save a route in local storage in their browser and/or download the route as a GPX file. This will require our Vite/Vercel backend to do a bit of processing to create the GPX file on the fly.

## Segment attributes

Each segment will have the following attributes:

- Difficulty: easy, medium, hard
- Quality of bike lane/path: poor, fair, good, great
- Scenic value: low, medium, high
- Surface type: asphalt, gravel, dirt

## Types of pins

- Water fountains
- Photo ops
- Rest stops

## Pages

There's just one user-facing page. It's just a full screen map with a sidebar for route details and filters. The sidebar includes the site name. The sidebar is collapsible.

## Style

- Didact Gothic font from Google Fonts.
- Friendly style that feels outdoorsy and inviting
- The main theme colors are a forest green and earthy tones sort of like https://www.wta.org
- Shouldn't feel childish, but definitely should not feel serious.
- Buttons and inputs should be similar to those used on https://us.posthog.com/signup and https://posthog.com and have a 3D appearance.

## Copy + marketing

There's no copy on the site beyond the site name in the sidebar. We keep things very clean. This is not meant to be a content-heavy site.

## Mobile

The whole site is responsive and optimized for mobile devices. This is essential for new cyclists who may be using the site while on the go.

## Tech stack

- Vite
- Mapbox
- Tailwind
- React
- TypeScript

## Admin page

There's a separate admin page that will let me build and manage routes, segments, and pins. This page is not intended for general users and will have additional controls for editing and organizing the data.

I'll start out with a folder of GPX files. These will be full routes from my apartment. The admin page has tools that will let me select points on the map to slice the routes into individual segments. And then also another tool that'll let me stitch together the segments into a full graph. I'll need to be able to connect up segments by specifying the exact point where two segments come together.

This final graph of segments can be a static graph on disk as JSON pointing to GPX files. Or we may design another representation -- up for discussion.

I should be able to easily edit the metadata for each segment from this admin page.

## Other

I have another project that uses mapbox and we can pull some code from this project to speed things up: /Users/chris/Documents/Code/Projects/Done/tuxc
