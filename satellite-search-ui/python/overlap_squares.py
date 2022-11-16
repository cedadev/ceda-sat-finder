

def overlapArea(A,B,C,D):
    
    top = B[1]
    if B[1] > D[1]:
        top = D[1]

    bot = A[1]
    if A[1] < C[1]:
        bot = C[1]


    olheight = top - bot

    left = A[0]
    if A[0] < C[0]:
        left = C[0]
    right = D[0]
    if B[0] < D[0]:
        right = B[0]

    olwidth = right - left

    return olwidth*olheight


A = [15,0]
B = [30,30]
C = [10,10]
D = [20,20]

print(overlapArea(A,B,C,D))