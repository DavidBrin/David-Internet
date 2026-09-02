public class DemoArrayImpl<E extends Comparable<E>> implements DemoArray{
    static final String INDEX_ERROR = "Index out of bound: ";
    E[] data;
    
    public DemoArrayImpl(E[] data){
        //complete a shallow copy
        this.data = data;
    }
    
    public E min(){
		if(data == null || data.length == 0){
			return null;
		}
		E minElement = data[0];
		for (int i=1; i<data.length; i++) {
			if(data[i].compareTo(minElement) < 0){
				minElement = data[i];
			}
		}
		return minElement;
	}

	public E get(int i) throws IndexOutOfBoundsException{
		if(data == null || data.length == 0) return null;
		if (i < 0 || i >= data.length){
			throw new IndexOutOfBoundsException(INDEX_ERROR + i);
		}
		return data[i];
	}

	public static void main(String[] args) {
		DemoArrayImpl<Integer> intArray =  new DemoArrayImpl<>(new Integer[]{7, 3, 16, 2, 5});
		System.out.println(intArray.get(0));
	}
}