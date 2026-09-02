/**
 * David Brin
 * A1*******
 * MyArrayList implements the MyList interface to implment an ArrayList
 * */
public class MyArrayList<E> implements MyList<E>{
    Object[] values; // the main data structure that keeps track of all objects
    int length; // length of the valid elems in values array
    static final int DEFAULT_CAPACITY = 5; //default capacity
    // no args constructor
    // creates object array of 5
    @SuppressWarnings("unchecked")
    public MyArrayList(){
        values = (E[]) new Object[DEFAULT_CAPACITY];
    }

    //initial capacity constructor
    //intializes object array with initial Capacity
    @SuppressWarnings("unchecked")
    public MyArrayList(int initialCapacity){
        if(initialCapacity < 0) throw new IllegalArgumentException();
        values = (E[]) new Object[initialCapacity];
    }

    //input array constructor
    //creates a shallow copy where length is arr.length
    //if array is null, use behavior of no args constructor
    @SuppressWarnings("unchecked")
    public MyArrayList(E[] arr){
        if(arr == null) values = (E[]) new Object[DEFAULT_CAPACITY];
        else {values = arr;
        this.length = arr.length;}
    }

    /**
     * doubles capacity or adds 5 if 0 
     * or sets to requiredCapacity if more than double current
     * @param requiredCapacity is required length of values
     */
    
     @SuppressWarnings("unchecked")
    public void expandCapacity(int requiredCapacity){
        if(requiredCapacity < values.length) throw new IllegalArgumentException();
        else if(values.length == 0 && DEFAULT_CAPACITY >= requiredCapacity) {
            values = (E[]) new Object[DEFAULT_CAPACITY];
        }
        else if(values.length == 0) {
            values = (E[]) new Object[requiredCapacity];
        }
        else if(values.length*2 > requiredCapacity){
            Object[] temp = (E[]) new Object[values.length*2];
            for(int i = 0; i < values.length; i ++){
                temp[i] = values[i];
            }
            values = temp;
        }
        else{
            Object[] temp = (E[]) new Object[requiredCapacity];
            for(int i = 0; i < values.length; i ++){
                temp[i] = values[i];
            }
            values = temp;
        }

    }
    
    /**
     * gets length of values
     * @return values.length
     */
    public int getCapacity(){
        return values.length;
    }

    /**
     * Inserts an element at specified index
     * updates capacity as needed
     * @param index inserting index
     * @param element object to insert
     */
    public void insert(int index, E element){
        if(index < 0 || index > values.length) throw new IndexOutOfBoundsException();
        if(length == values.length){
            expandCapacity(length + 1);

            for(int i = values.length-1; i > index; i --){
                values[i] = values[i-1];
            }
            values[index] = element;
            length ++;
        }
        else{
            for(int i = values.length-1; i > index; i --){
                values[i] = values[i-1];
            }
            values[index] = element;
            length ++;
        }
    }

    /**
     * adds an element to the end of the list
     * @param element is element to be added
     */
    public void append (E element){
        if(length >= values.length || values.length == 0) expandCapacity(length + 1);
        values[length] = element;
        length ++;
    }

    /**
     * add element to beginning of list
     * @param element is element to be added
     */
    public void prepend(E element){
        if(length >= values.length || values.length == 0) expandCapacity(length + 1);
        for(int i = values.length-1; i > 0; i--){
            values[i] = values[i-1];
        }
        values[0] = element;
        length ++;
    }

    /**
     * get element at
     * @param index
     * @return element
     */@SuppressWarnings("unchecked")
    public E get(int index){
        if(index < 0 || index >= length) throw new IndexOutOfBoundsException();
        return (E)values[index];
    }

    /**
     * Set element at index to overwrite current elem
     * @param index
     * @param element
     * @return overwritten element
     */@SuppressWarnings("unchecked")
    public E set(int index, E element){
        if(index < 0 || index >= length) throw new IndexOutOfBoundsException();
        E ret = (E)values[index];
        values[index] = element;
        return ret;
    }

    /**
     * remove and return elem at index
     * @param index
     * @return element at index
     */@SuppressWarnings("unchecked")
    public E remove(int index){
        if(index < 0 || index >= length) throw new IndexOutOfBoundsException();
        E ret = (E)values[index];
        for(int i = index; i < values.length -1; i ++){
            values[i] = values[i+1];
        }
        values[values.length -1] = null;
        length --;
        return ret;
    }    

    /**
     * returns number of elements
     * @return number of elements
     */
    public int size(){
        return length;
    }
    
        /**
         * rotates array left by index amount
         * @param index
         */@SuppressWarnings("unchecked")
        public void rotate(int index){
            if(index < 0 || index >= length) throw new IndexOutOfBoundsException();
            for(int i = 0; i < index; i ++){
                E temp = (E)values[0];
                for(int j = 0; j < length -1; j ++){
                    values[j] = values[j + 1];
                }
                values[length-1] = temp;
            }
        }
    


    /**
     * find param element
     * @param element
     * @return first occurence index of element or -1
     */
    public int find(E element){
        for(int i = 0; i < values.length; i ++){
            if(element != null && element.equals(values[i])){
                return i;
            }
            else if(values[i] == null) return i;
        }
        return -1;
    }

}