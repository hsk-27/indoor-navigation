import { NodeInfo, RouteResponse } from '../context/RouteContext';

// Centralized mock data matching the RouteContext structures
export const MockNodes: NodeInfo[] = [
  { id: 1, name: 'Main Entrance', type: 'Entrance', floorId: 1, floorName: 'Ground Floor', x: 100, y: 500 },
  { id: 2, name: 'Computer Science Dept', type: 'Department', floorId: 1, floorName: 'Ground Floor', x: 300, y: 500 },
  { id: 3, name: 'Physics Lab', type: 'Laboratory', floorId: 1, floorName: 'Ground Floor', x: 500, y: 300 },
  { id: 4, name: 'Staircase A', type: 'Staircase', floorId: 1, floorName: 'Ground Floor', x: 200, y: 200 },
  { id: 5, name: 'Staircase A', type: 'Staircase', floorId: 2, floorName: 'First Floor', x: 200, y: 200 },
  { id: 6, name: 'Faculty Office 201', type: 'Office', floorId: 2, floorName: 'First Floor', x: 400, y: 200 },
];

export const MockEdges = [
  { id: 101, sourceId: 1, destinationId: 4, distance: 300 }, // Entrance to Staircase A
  { id: 102, sourceId: 1, destinationId: 2, distance: 200 }, // Entrance to CS Dept
  { id: 103, sourceId: 2, destinationId: 3, distance: 200 }, // CS Dept to Physics Lab
  { id: 104, sourceId: 4, destinationId: 5, distance: 50 },  // Staircase A Ground to First
  { id: 105, sourceId: 5, destinationId: 6, distance: 200 }  // Staircase A First to Faculty Office
];

export const MockRouteResponse: RouteResponse = {
  totalDistance: 45.5,
  instructions: [
    'Proceed straight from Main Entrance',
    'Turn left towards Staircase A',
    'Go up to First Floor',
    'Destination Faculty Office 201 is on your right'
  ],
  path: [
    MockNodes[0],
    MockNodes[3],
    MockNodes[4],
    MockNodes[5]
  ]
};
