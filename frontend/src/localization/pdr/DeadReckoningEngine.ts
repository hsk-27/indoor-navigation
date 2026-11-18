import { HeadingEstimate } from './HeadingEstimator';
import { LocalizationEstimate, MotionState } from '../providers/ILocalizationProvider';
import { EstimatedCartesianPosition } from '../LocalizationState';

export class DeadReckoningEngine {
    
    /**
     * Calculates the full PDR estimate for a single step.
     */
    public generateEstimate(
        currentPosition: EstimatedCartesianPosition,
        headingEstimate: HeadingEstimate, 
        stepLength: number,
        cadence: number,
        motionState: MotionState,
        pixelsPerMeter: number,
        timestamp: number
    ): LocalizationEstimate {
        
        // Maps geographic heading to graph coordinates:
        // - North (0 rad) = Up (dy = -1, dx = 0)
        // - East (PI/2 rad) = Right (dy = 0, dx = 1)
        const dx = stepLength * Math.sin(headingEstimate.heading);
        const dy = -stepLength * Math.cos(headingEstimate.heading);
        
        const newX = currentPosition.x + dx * pixelsPerMeter;
        const newY = currentPosition.y + dy * pixelsPerMeter;
        
        const velocity = stepLength * (cadence / 60); // meters per second

        return {
            position: {
                x: newX,
                y: newY,
                floorId: currentPosition.floorId,
                accuracy: currentPosition.accuracy,
                timestamp: timestamp
            },
            heading: headingEstimate.heading,
            headingStability: headingEstimate.stability,
            velocity: velocity,
            motionState: motionState,
            baseConfidence: 'HIGH', // PDR alone is confident in the short term
            timestamp: timestamp
        };
    }
}
