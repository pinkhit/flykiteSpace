const int numCircles = 20;

struct circleEmitter {
  vec2 center;
  float radius;
};

circleEmitter[numCircles] circles;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

	// we want to offset uv to have 0,0 in center
		// circle is defined as center(0,0) in middle
	uv.x = uv.x - 0.5;
	uv.y = uv.y - 0.5;

    // // Time varying pixel color
    // vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
    vec3 col = vec3(0.0);

    // circles at top & bottom (opposite shores)
    vec2 top = vec2(0.0, 0.5);
    vec2 bott = vec2(0.0, -0.5);

    // init circles - define center, start rad
    // recall:  shader min(x,y)=(-0.5) max(x,y) = 0.5
    for (int i = 0; i < numCircles; ++i)
    {
        // if even - bottom shore
        if (i % 2 == 0)
        {
            // default:1
            circles[i].radius = 1.0;
            /// sould cover the full visible xaxis range [-0.5, 0.5]
            float x = uv.x + (float(i)/float(numCircles)) - 0.5;
            x += 0.05;// to offset the indexing causing staggering
            circles[i].center = vec2(x, uv.y - bott.y);
        }
        // odd - top shore
        else
        {
            circles[i].radius = 1.0;
            float x = uv.x + (float(i)/float(numCircles)) - 0.5;
            circles[i].center = vec2(x, uv.y - top.y);
        }
    }

    // update circles - update rad
    for (int i = 0; i < numCircles; ++i)
    {
        circles[i].radius *= abs(cos(iTime));
        // if out of range, kill
    }


	// to draw circle
    // if center is (0,0) uv is the vector in that direction (uv.xy - 0 = uv)

    // draw circles
    for (int i = 0; i < numCircles; ++i)
    {
        // for each circle
        // distance from center to edge of circle
        float distanceSquared = (circles[i].center.x) * (circles[i].center.x) + (circles[i].center.y) * (circles[i].center.y);
        // lerp between 0 and 1
        //float osc = abs(sin(time));
        if (sqrt(distanceSquared) <= circles[i].radius && sqrt(distanceSquared) >= circles[i].radius - 0.01)
            col = vec3(1.0);
    }

    if (col.x == 0.0) discard;
    // Output to screen
    fragColor = vec4(col,1.0);

}